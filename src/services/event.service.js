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
  user: { select: { id: true, firstname: true, lastname: true, email: true } },
};

/**
 * No implicit "upcoming" filter — the caller passes `from` (API.md §Events).
 * A list with no filters is the whole calendar, oldest first.
 */
export const findAllEvents = async ({ from, to, status }) => {
  return await prisma.event.findMany({
    where: {
      ...(status ? { status } : {}),
      ...(from || to
        ? { startTime: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } }
        : {}),
    },
    select: eventSelect,
    orderBy: [{ startTime: "asc" }, { id: "asc" }],
  });
};

/** Includes the attendee list — GET /events/:id shows it in one round trip. */
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

/**
 * (event_id, user_id) is the composite primary key, so a second RSVP updates
 * instead of 409-ing (API.md §Events).
 */
export const upsertRsvp = async (eventId, userId, rsvpStatus) => {
  return await prisma.eventAttendee.upsert({
    where: { eventId_userId: { eventId, userId } },
    create: { eventId, userId, rsvpStatus },
    update: { rsvpStatus },
    select: attendeeSelect,
  });
};

/** skipDuplicates: re-inviting somebody already on the list is a no-op. */
export const inviteAttendees = async (eventId, userIds) => {
  return await prisma.eventAttendee.createMany({
    data: userIds.map((userId) => ({ eventId, userId })),
    skipDuplicates: true,
  });
};
