import { prisma } from '../lib/prisma.js'
import { cancelOwnBooking } from '../lib/reservation.js'

/**
 * Everything one person has claimed, rooms and cars together (API.md §481).
 *
 * The two models live in separate tables with no shared parent, so "my
 * bookings" cannot be one query — it is two, merged here. That is the whole
 * reason this file exists: every other read in the reserve module answers a
 * question about ONE resource, and this one deliberately does not.
 *
 * Two shapes are flattened on the way out, and both matter to the caller:
 *
 *   type       "room" | "car". Booking ids are only unique WITHIN a table —
 *              room booking 88 and car booking 88 both exist — so an id alone
 *              does not identify a booking and every link out of this list
 *              needs the type beside it.
 *   resource   the room or the car, under one key. A table rendering both kinds
 *              of row would otherwise branch in every single cell.
 *
 * REJECTED and CANCELLED are KEPT, unlike the availability reads which drop
 * them. This is a history, not a picture of what is free: "I cancelled that"
 * and "an admin rejected that" are answers the page has to be able to give.
 *
 * Newest first. `startTime` and not `createdAt`, because a booking is filed
 * under when it happens, not when it was typed.
 */
const REQUESTER = {
  select: {
    id: true,
    firstname: true,
    lastname: true,
    email: true,
    department: { select: { id: true, name: true } },
  },
}

/**
 * The two-table read both cross-resource lists are built from.
 *
 * No Prisma `orderBy`: the merged array is re-sorted here anyway, and an
 * ordering declared twice is an ordering that can disagree with itself.
 */
const listBookings = async ({ where, sortBy = 'startTime', desc = true }, db = prisma) => {
  const [rooms, cars] = await Promise.all([
    db.roomBooking.findMany({ where, include: { room: true, user: REQUESTER } }),
    db.carBooking.findMany({ where, include: { car: true, user: REQUESTER } }),
  ])

  return [
    ...rooms.map(({ room, ...booking }) => ({ ...booking, type: 'room', resource: room })),
    ...cars.map(({ car, ...booking }) => ({ ...booking, type: 'car', resource: car })),
  ].sort((a, b) => (desc ? b[sortBy] - a[sortBy] : a[sortBy] - b[sortBy]))
}

export const getMyBookings = async (userId, db = prisma) =>
  await listBookings({ where: { userId } }, db)

/**
 * Everything waiting on an admin, longest wait first.
 *
 * Sorted by createdAt and NOT startTime: this is a queue, so the row that has
 * been waiting since yesterday comes first even if the meeting it asks for is
 * months away. Sorting by the booking's own date would bury a stale request
 * behind every soon-but-just-filed one.
 *
 * NOT scoped by department, deliberately. A room is not owned by one — and the
 * write this screen drives, PATCH .../bookings/:id/status, has no department
 * check either. Filtering here would only hide rows from an admin who is still
 * allowed to approve them, and leave some pending bookings in nobody's queue.
 */
export const getPendingBookings = async (db = prisma) =>
  await listBookings({ where: { status: 'PENDING' }, sortBy: 'createdAt', desc: false }, db)

/**
 * Cancel by type — the routes hand over the noun, this picks the table.
 *
 * The rule itself is cancelOwnBooking in lib/reservation.js; this is only the
 * lookup that keeps `prisma` out of the controllers.
 */
const DELEGATE = {
  room: () => prisma.roomBooking,
  car: () => prisma.carBooking,
}

export const cancelMyBooking = async (type, id, userId) =>
  await cancelOwnBooking(DELEGATE[type](), id, userId)
