import createHttpError from "http-errors";
import {
  checkInAttendee,
  closeEvent,
  countInvitableUsers,
  createEvent,
  findAllEvents,
  findAttendeeByEventAndUser,
  findAttendeesByEventId,
  findEventById,
  inviteAttendees,
  updateEventById,
  upsertRsvp,
} from "../services/event.service.js";
import { notifyEventInvited } from "../services/notifications.service.js";
import { createEventQrToken, verifyEventQrToken } from "../utils/jwt.js";

/** Allows the organizer or system admin. */
const assertCanManage = (event, user) => {
  if (event.organizerId !== user.id && user.role !== "ADMIN_SYSTEM") {
    throw createHttpError(403, "Insufficient permission");
  }
};

const loadEvent = async (eventId) => {
  const event = await findEventById(eventId);

  if (!event) {
    throw createHttpError(404, "Event not found");
  }

  return event;
};

export async function listEvents(req, res, next) {
  try {
    const staffId = req.user.role === "STAFF" ? req.user.id : undefined;
    const events = await findAllEvents(req.valid.query, staffId);

    return res.status(200).json({ events });
  } catch (error) {
    next(error);
  }
}

export async function getEvent(req, res, next) {
  try {
    const event = await loadEvent(req.valid.params.id);

    if (req.user.role === "STAFF") {
      const attendee = event.attendees.find(
        ({ user }) => user.id === req.user.id,
      );

      if (!attendee) {
        throw createHttpError(404, "Event not found");
      }

      return res.status(200).json({
        event: {
          ...event,
          attendees: [attendee],
        },
      });
    }

    return res.status(200).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function createEventByAdmin(req, res, next) {
  try {
    // The logged-in admin is the organizer.
    const event = await createEvent({
      ...req.valid.body,
      organizerId: req.user.id,
    });

    return res.status(201).json({
      message: "Event created successfully",
      event,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateEvent(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const eventToUpdate = await loadEvent(eventId);

    assertCanManage(eventToUpdate, req.user);

    const { status } = req.valid.body;

    if (status === "LIVE" && eventToUpdate.status !== "PENDING") {
      throw createHttpError(409, "Only a pending event can go live");
    }

    if (status === "CLOSED" && eventToUpdate.status !== "LIVE") {
      throw createHttpError(409, "Only a live event can be closed");
    }

    const event =
      status === "CLOSED"
        ? await closeEvent(eventId, req.valid.body)
        : await updateEventById(eventId, req.valid.body);

    return res.status(200).json({
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    next(error);
  }
}

/** Cancels the event without deleting its history. */
export async function cancelEvent(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const eventToCancel = await loadEvent(eventId);

    assertCanManage(eventToCancel, req.user);

    if (eventToCancel.status !== "PENDING") {
      throw createHttpError(409, "Only a pending event can be cancelled");
    }

    const event = await updateEventById(eventId, { status: "CANCEL" });

    return res.status(200).json({
      message: "Event cancelled successfully",
      event,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAttendees(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);

    assertCanManage(event, req.user);

    const attendees = await findAttendeesByEventId(eventId);

    return res.status(200).json({ attendees });
  } catch (error) {
    next(error);
  }
}

/** Updates the logged-in user's invitation. */
export async function setRsvp(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);

    if (event.status !== "PENDING") {
      throw createHttpError(409, "RSVP is closed");
    }

    const attendee = await upsertRsvp(
      eventId,
      req.user.id,
      req.valid.body.rsvpStatus,
    );

    return res.status(200).json({
      message: "RSVP updated successfully",
      attendee,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return next(createHttpError(404, "Invitation not found"));
    }

    next(error);
  }
}

/** Returns the logged-in attendee's personal QR token. */
export async function getEventQr(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);
    const attendee = await findAttendeeByEventAndUser(eventId, req.user.id);

    if (!attendee) {
      throw createHttpError(404, "Invitation not found");
    }

    if (!["PENDING", "LIVE"].includes(event.status)) {
      throw createHttpError(409, "QR code is unavailable for this event");
    }

    if (attendee.rsvpStatus !== "ACCEPTED") {
      throw createHttpError(409, "Accept the invitation before getting a QR code");
    }

    const token = createEventQrToken({
      eventId,
      userId: req.user.id,
      endTime: event.endTime,
    });

    return res.status(200).json({ token });
  } catch (error) {
    next(error);
  }
}

/** Checks in by QR token or user ID. */
export async function checkInEvent(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);

    assertCanManage(event, req.user);

    if (event.status !== "LIVE") {
      throw createHttpError(409, "Event is not live");
    }

    let { userId } = req.valid.body;

    if (req.valid.body.token) {
      try {
        const payload = verifyEventQrToken(req.valid.body.token);

        if (
          payload.type !== "EVENT_CHECKIN" ||
          payload.eventId !== eventId ||
          !Number.isInteger(payload.userId)
        ) {
          throw new Error("Invalid QR payload");
        }

        userId = payload.userId;
      } catch {
        throw createHttpError(400, "Invalid or expired QR code");
      }
    }

    const attendee = await checkInAttendee(eventId, userId, req.user.id);

    if (!attendee) {
      throw createHttpError(409, "Check-in failed");
    }

    return res.status(200).json({
      message: "Check-in successful",
      attendee,
    });
  } catch (error) {
    next(error);
  }
}

export async function addAttendees(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);

    assertCanManage(event, req.user);

    const { userIds } = req.valid.body;

    if (event.status !== "PENDING") {
      throw createHttpError(409, "Invitations are closed");
    }

    const departmentId =
      req.user.role === "ADMIN_DEPT" ? req.user.departmentId : undefined;
    const allowedCount = await countInvitableUsers(userIds, departmentId);

    if (allowedCount !== userIds.length) {
      throw createHttpError(400, "Some users cannot be invited");
    }

    const { count } = await inviteAttendees(eventId, userIds);

    await notifyEventInvited({ event, userIds, actorId: req.user.id });

    const attendees = await findAttendeesByEventId(eventId);

    return res.status(201).json({
      message: `${count} attendee(s) invited`,
      attendees,
    });
  } catch (error) {
    // Handles a user deleted during the request.
    if (error.code === "P2003") {
      return next(createHttpError(400, "One or more userIds do not exist"));
    }

    next(error);
  }
}
