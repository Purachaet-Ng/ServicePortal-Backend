import { prisma } from "../lib/prisma.js";
import { sendMail } from "../lib/mailer.js";

const notificationSelect = {
  id: true,
  message: true,
  link: true,
  readAt: true,
  createdAt: true,
};

/**
 * Every read here is scoped by `userId`, and that id must come from
 * `req.user` — never from the request. API.md §Notifications.
 */
export const findNotificationsByUserId = async (userId, { unread, limit }) => {
  return await prisma.notification.findMany({
    where: {
      userId,
      ...(unread ? { readAt: null } : {}),
    },
    select: notificationSelect,
    // Rows written together share a createdAt to the millisecond (the seed
    // does exactly this), so id breaks the tie and keeps paging stable.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
};

export const countUnreadByUserId = async (userId) => {
  return await prisma.notification.count({
    where: { userId, readAt: null },
  });
};

/** Includes `userId` so the caller can check ownership before updating. */
export const findNotificationById = async (notificationId) => {
  return await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { ...notificationSelect, userId: true },
  });
};

export const markNotificationReadById = async (notificationId) => {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: notificationSelect,
  });
};

/** Returns Prisma's `{ count }` — how many rows were still unread. */
export const markAllNotificationsReadByUserId = async (userId) => {
  return await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};

/**
 * The only way a notification is ever written. There is no POST endpoint and
 * there should not be one — a client that can write its own notifications can
 * write them for anybody.
 */
export const createNotification = async (userId, message) => {
  return await prisma.notification.create({
    data: { userId, message },
    select: notificationSelect,
  });
};

/** A dropdown row is ~40 characters wide; a long title would bury the verb. */
const MAX_TITLE = 60;

const quoteTitle = (title) =>
  `"${title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1)}\u2026` : title}"`;

/**
 * Emails the same people the same sentence they were just given in the app.
 * Every fan-out below already builds a `Map<userId, message>` and a link to
 * write its rows from, so it hands those straight over.
 *
 * The addresses cost one query the fan-outs would not otherwise make \u2014 but
 * only when mail is switched on, and one shared shape here beats threading
 * `email` through five different recipient lookups.
 *
 * Never throws, for the reason given on notifyTicketUpdated. sendMail is
 * deliberately not awaited: see its comment.
 */
const mailNotifications = async (messages, link) => {
  if (!process.env.SMTP_HOST) return;

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: [...messages.keys()] } },
      select: { id: true, email: true },
    });

    // Relative in the app, absolute in an inbox.
    const base = process.env.CORS_ORIGIN ?? "";

    for (const { id, email } of users) {
      const message = messages.get(id);
      sendMail(email, message, `${message}\n\n${base}${link}`);
    }
  } catch (error) {
    console.error("[mail] recipient lookup failed", error);
  }
};

/**
 * Fan-out for PATCH /tickets/:id and /tickets/:id/status
 * (API.md \u00a7Notifications: "a ticket is assigned, a ticket's status changes").
 *
 * Reads before/after rather than the request body, so a PATCH that repeats a
 * value the ticket already holds notifies nobody.
 *
 * NEVER THROWS. The ticket update is committed by the time this runs, so a
 * failure here would answer 500 for a change that did happen — and the client
 * would retry a PATCH that already succeeded. A missed notification is the
 * cheaper failure, so it is logged and swallowed.
 */
export const notifyTicketUpdated = async ({ before, after, actorId }) => {
  // userId -> message, so one PATCH is at most one row per person even when
  // the assignee and the status both move.
  const messages = new Map();

  if (before.assignedToId !== after.assignedToId && after.assignedToId) {
    messages.set(
      after.assignedToId,
      `Ticket ${quoteTitle(after.title)} was assigned to you`,
    );
  }

  if (before.status !== after.status) {
    // Whoever raised it and whoever is working it both want to know.
    for (const userId of [after.createdById, after.assignedToId]) {
      if (userId && !messages.has(userId)) {
        messages.set(
          userId,
          `Ticket ${quoteTitle(after.title)} moved to ${after.status}`,
        );
      }
    }
  }

  // Nobody needs telling about their own action.
  messages.delete(actorId);

  if (messages.size === 0) return;

  const link = `/tickets/${after.id}`;

  try {
    await prisma.notification.createMany({
      data: [...messages].map(([userId, message]) => ({
        userId,
        message,
        link,
      })),
    });

    await mailNotifications(messages, link);
  } catch (error) {
    console.error("[notifications] ticket fan-out failed", error);
  }
};

/**
 * Fan-out for POST /tickets.
 *
 * API.md's trigger list does not name creation, but the seed's own demo rows
 * do \u2014 "Somchai Prasert submitted a new ticket", written to an ADMIN_DEPT \u2014
 * and the dashboard's "Awaiting triage" card only means something if somebody
 * is told the queue grew. Nobody triages a queue they do not know about.
 *
 * Recipients are that department's admins. The department comes from
 * requestType.departmentId, since the client never sends department_id
 * (API.md \u00a7Tickets). ADMIN_SYSTEM is deliberately excluded \u2014 it would collect
 * every ticket in the organisation.
 *
 * Never throws, for the reason given on notifyTicketUpdated.
 */
export const notifyTicketCreated = async ({ ticket, departmentId, actor }) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN_DEPT", departmentId },
      select: { id: true },
    });

    const submitter = `${actor.firstname} ${actor.lastname}`.trim() || "Someone";
    // The seed distinguishes these two, so keep the wording it established.
    const urgency = ticket.priority === "URGENT" ? "an urgent" : "a new";

    const messages = new Map(
      admins.map(({ id }) => [
        id,
        `${submitter} submitted ${urgency} ticket ${quoteTitle(ticket.title)}`,
      ]),
    );

    // The request type's default assignee, resolved by ticketCreate().
    if (ticket.assignedToId) {
      messages.set(
        ticket.assignedToId,
        `Ticket ${quoteTitle(ticket.title)} was assigned to you`,
      );
    }

    // The person who raised it does not need telling they raised it.
    messages.delete(actor.id);

    if (messages.size === 0) return;

    const link = `/tickets/${ticket.id}`;

    await prisma.notification.createMany({
      data: [...messages].map(([userId, message]) => ({
        userId,
        message,
        link,
      })),
    });

    await mailNotifications(messages, link);
  } catch (error) {
    console.error("[notifications] ticket create fan-out failed", error);
  }
};

/**
 * Fan-out for POST /events/:id/attendees
 * (API.md §Notifications: "you are invited to an event").
 *
 * Never throws, for the reason given on notifyTicketUpdated.
 */
export const notifyEventInvited = async ({ event, userIds, actorId }) => {
  const recipients = userIds.filter((userId) => userId !== actorId);

  if (recipients.length === 0) return;

  const message = `You were invited to ${quoteTitle(event.title)}`;
  const link = `/events/${event.id}`;

  try {
    await prisma.notification.createMany({
      data: recipients.map((userId) => ({ userId, message, link })),
    });

    await mailNotifications(
      new Map(recipients.map((userId) => [userId, message])),
      link,
    );
  } catch (error) {
    console.error("[notifications] event invite fan-out failed", error);
  }
};

/**
 * Fan-out for POST /reserves/{rooms,cars}/:id/book. One function for both —
 * a room booking and a car booking are the same shape once you have the
 * resource's name, and duplicating this per type would just be two copies to
 * keep in sync.
 *
 * Recipients are every ADMIN_DEPT and ADMIN_SYSTEM, not one department's
 * admins: room_bookings/car_bookings carry no department, and neither does
 * the approval queue (getPendingBookings in booking.service.js) — so there is
 * no narrower "the right admins" to pick.
 *
 * Never throws, for the reason given on notifyTicketUpdated.
 */
export const notifyBookingCreated = async ({ type, booking, resourceName, actor }) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN_DEPT", "ADMIN_SYSTEM"] } },
      select: { id: true },
    });

    const requester = `${actor.firstname} ${actor.lastname}`.trim() || "Someone";
    const recipients = admins
      .map(({ id }) => id)
      // An admin booking their own room/car does not need telling.
      .filter((id) => id !== actor.id);

    if (recipients.length === 0) return;

    const message = `${requester} requested to book ${quoteTitle(resourceName)}`;
    const link = `/bookings/${type}/${booking.id}`;

    await prisma.notification.createMany({
      data: recipients.map((userId) => ({ userId, message, link })),
    });

    await mailNotifications(
      new Map(recipients.map((userId) => [userId, message])),
      link,
    );
  } catch (error) {
    console.error(`[notifications] ${type} booking create fan-out failed`, error);
  }
};

/**
 * Fan-out for PATCH /reserves/{rooms,cars}/bookings/:id/status.
 *
 * Only APPROVED and REJECTED reach here in practice: CANCELLED is set by
 * cancelMyBooking on the requester's own booking, and telling someone their
 * own action happened is pointless. PENDING never arrives on a status PATCH.
 *
 * Never throws, for the reason given on notifyTicketUpdated.
 */
export const notifyBookingStatusChanged = async ({
  type,
  booking,
  resourceName,
  actorId,
}) => {
  // Nobody needs telling about their own action.
  if (booking.userId === actorId) return;

  // The reason rides along on a rejection. A bare "was rejected" sends the
  // requester to the page to find out why, and the email — which is the copy
  // most of them actually read — could not tell them at all.
  const outcome = `Your booking for ${quoteTitle(resourceName)} was ${booking.status.toLowerCase()}`;
  const message = booking.rejectionReason
    ? `${outcome}: ${booking.rejectionReason}`
    : outcome;
  const link = `/bookings/${type}/${booking.id}`;

  try {
    await prisma.notification.create({
      data: { userId: booking.userId, message, link },
    });

    await mailNotifications(new Map([[booking.userId, message]]), link);
  } catch (error) {
    console.error(`[notifications] ${type} booking status fan-out failed`, error);
  }
};
