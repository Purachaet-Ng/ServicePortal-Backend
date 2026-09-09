import { prisma } from "../lib/prisma.js";

const eventSelect = {
  id: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  status: true,
  organizerId: true,
  organizer: { select: { id: true, firstname: true, lastname: true } },
};

const attendeeSelect = {
  rsvpStatus: true,
  checkedInAt: true,
  checkedInById: true,
  user: { select: { id: true, firstname: true, lastname: true, email: true } },
};

/** Returns all events unless filters are provided. */
export const findAllEvents = async ({ from, to, status }, staffId) => {
  const events = await prisma.event.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
      ...(staffId ? { attendees: { some: { userId: staffId } } } : {}),
    },
    select: {
      ...eventSelect,
      ...(staffId
        ? {
            attendees: {
              where: { userId: staffId },
              select: { rsvpStatus: true },
            },
          }
        : {}),
    },
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });

  if (!staffId) return events;

  return events.map(({ attendees, ...event }) => ({
    ...event,
    rsvpStatus: attendees[0]?.rsvpStatus ?? null,
  }));
};

/** Returns one event with its attendees. */
export const findEventById = async (eventId) => {
  return await prisma.event.findUnique({
    where: { id: eventId },
    select: { ...eventSelect, attendees: { select: attendeeSelect } },
  });
};

export const createEvent = async (eventData) => {
  return await prisma.event.create({ data: eventData, select: eventSelect });
};

export const updateEventById = async (eventId, eventFieldsToUpdate) => {
  return await prisma.event.update({
    where: { id: eventId },
    data: eventFieldsToUpdate,
    select: eventSelect,
  });
};

export const findAttendeesByEventId = async (eventId) => {
  return await prisma.eventAttendee.findMany({
    where: { eventId },
    select: attendeeSelect,
    orderBy: { userId: "asc" },
  });
};

/** Finds one invited attendee. */
export const findAttendeeByEventAndUser = async (eventId, userId) => {
  return await prisma.eventAttendee.findUnique({
    where: { eventId_userId: { eventId, userId } },
    select: attendeeSelect,
  });
};

/** Updates an existing invitation response. */
export const upsertRsvp = async (eventId, userId, rsvpStatus) => {
  return await prisma.eventAttendee.update({
    where: { eventId_userId: { eventId, userId } },
    data: { rsvpStatus },
    select: attendeeSelect,
  });
};

/** Checks in an accepted attendee once. */
export const checkInAttendee = async (eventId, userId, checkedInById) => {
  return await prisma.$transaction(async (tx) => {
    const { count } = await tx.eventAttendee.updateMany({
      where: {
        eventId,
        userId,
        rsvpStatus: "ACCEPTED",
        checkedInAt: null,
      },
      data: {
        rsvpStatus: "ATTENDED",
        checkedInAt: new Date(),
        checkedInById,
      },
    });

    if (!count) return null;

    return await tx.eventAttendee.findUnique({
      where: { eventId_userId: { eventId, userId } },
      select: attendeeSelect,
    });
  });
};

/** Closes the event and marks missing attendees absent. */
export const closeEvent = async (eventId, eventFieldsToUpdate) => {
  const [event] = await prisma.$transaction([
    prisma.event.update({
      where: { id: eventId },
      data: { ...eventFieldsToUpdate, status: "CLOSED" },
      select: eventSelect,
    }),
    prisma.eventAttendee.updateMany({
      where: { eventId, rsvpStatus: "ACCEPTED" },
      data: { rsvpStatus: "ABSENT" },
    }),
  ]);

  return event;
};

/** Counts staff allowed to join the event. */
export const countInvitableUsers = async (userIds, departmentId) => {
  return await prisma.user.count({
    where: {
      id: { in: userIds },
      role: "STAFF",
      ...(departmentId === undefined ? {} : { departmentId }),
    },
  });
};

/** Ignores staff who are already invited. */
export const inviteAttendees = async (eventId, userIds) => {
  return await prisma.eventAttendee.createMany({
    data: userIds.map((userId) => ({ eventId, userId })),
    skipDuplicates: true,
  });
};
