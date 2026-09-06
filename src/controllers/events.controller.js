import createHttpError from "http-errors";
import {
  createEvent,
  findAllEvents,
  findAttendeesByEventId,
  findEventById,
  inviteAttendees,
  updateEventById,
  upsertRsvp,
} from "../services/event.service.js";
import { notifyEventInvited } from "../services/notifications.service.js";

/** authorize() cannot express "organizer OR admin", so it lives here. */
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
    const events = await findAllEvents(req.valid.query);

    return res.status(200).json({ events });
  } catch (error) {
    next(error);
  }
}

export async function getEvent(req, res, next) {
  try {
    const event = await loadEvent(req.valid.params.id);

    return res.status(200).json({ event });
  } catch (error) {
    next(error);
  }
}

export async function createEventByAdmin(req, res, next) {
  try {
    // The organizer is whoever is holding the token — never the request body.
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

    const event = await updateEventById(eventId, req.valid.body);

    return res.status(200).json({
      message: "Event updated successfully",
      event,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE cancels — it does not remove the row. Attendees hold a foreign key
 * to it, and an event that was called off is history somebody still reads.
 */
export async function cancelEvent(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const eventToCancel = await loadEvent(eventId);

    assertCanManage(eventToCancel, req.user);

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
    await loadEvent(eventId);

    const attendees = await findAttendeesByEventId(eventId);

    return res.status(200).json({ attendees });
  } catch (error) {
    next(error);
  }
}

/** Your own RSVP only — the user id comes from the token. */
export async function setRsvp(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    await loadEvent(eventId);

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
    next(error);
  }
}

export async function addAttendees(req, res, next) {
  try {
    const eventId = req.valid.params.id;
    const event = await loadEvent(eventId);

    assertCanManage(event, req.user);

    const { userIds } = req.valid.body;
    const { count } = await inviteAttendees(eventId, userIds);

    await notifyEventInvited({ event, userIds, actorId: req.user.id });

    const attendees = await findAttendeesByEventId(eventId);

    return res.status(201).json({
      message: `${count} attendee(s) invited`,
      attendees,
    });
  } catch (error) {
    // A userId that is not a real user — cheaper to catch than to pre-check.
    if (error.code === "P2003") {
      return next(createHttpError(400, "One or more userIds do not exist"));
    }

    next(error);
  }
}
