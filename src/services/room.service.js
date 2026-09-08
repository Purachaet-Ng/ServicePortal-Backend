import createHttpError from 'http-errors'
import {prisma} from '../lib/prisma.js'
// Shared with car.service.js — see src/lib/reservation.js for why these are not
// defined here any more.
import {
  HOLDS_A_SLOT,
  clockIn,
  dayIn,
  isOverlapViolation,
} from '../lib/reservation.js'

// ดึงข้อมูลห้องทั้งหมด
export const getAllRooms = async () => {
    const rooms = await prisma.room.findMany();
    
    return rooms;
};

export const getRoomById = async (roomId) => {
  return await prisma.room.findUnique({
    where: {
      id: roomId
    }
  })
}

export const getRoomBookingById = async (roomBookingId) => {
  return await prisma.roomBooking.findUnique({
    where: {
      id: roomBookingId
    }
  })
}

export const addRoom = async (data) => {
    const room = await prisma.room.create({data});
    return room
}


/**
 * Book a room, refusing the slot if someone already holds it.
 *
 * The check and the insert are ONE transaction. Reading first and creating
 * afterwards outside a transaction is the same bug with more steps.
 *
 * Overlap is half-open — `existing.start < new.end AND existing.end > new.start`
 * — so a booking that ENDS exactly when another begins is allowed. Touching is
 * not overlapping, and refusing back-to-back bookings would make a meeting room
 * unusable for consecutive meetings, which is most of what a meeting room is
 * for.
 *
 * `data.status` is deliberately IGNORED. createRoomBookingSchema requires the
 * field and POST /rooms/bookings is open to any authenticated user, so honouring
 * it would let anyone approve their own booking by sending status APPROVED —
 * approval has its own admin-gated route (PATCH /rooms/bookings/:id/status).
 * Every booking starts PENDING via the schema default. Do not "fix" this by
 * passing status through.
 *
 * `db` is injectable so the overlap rules can be tested without a database;
 * it defaults to the real client (room.overlap.test.js).
 *
 * This check is NOT what makes overlap impossible. A transaction at Postgres'
 * default READ COMMITTED does not stop two concurrent bookings from both
 * finding the slot free and both inserting; only the exclusion constraint
 * room_bookings_no_overlap does (migration 20260907130000). What this check is
 * for is the MESSAGE — it names the room and the hours, which a raw constraint
 * violation cannot. The catch below is the same answer for the rare case where
 * the constraint gets there first.
 *
 * The two must agree, and they are written to: half-open ranges either side,
 * and the same PENDING/APPROVED set in HOLDS_A_SLOT and in the constraint's
 * WHERE clause. Change one and you must change the other.
 */
export const addRoomBooking = async (data, id, db = prisma) => {
  return await db.$transaction(async (tx) => {
    const clash = await tx.roomBooking.findFirst({
      where: {
        roomId: data.roomId,
        status: { in: HOLDS_A_SLOT },
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime }
      },
      // The message names the room, so the row has to carry it.
      include: { room: { select: { name: true } } }
    })

    if (clash) {
      throw createHttpError(
        409,
        `${clash.room.name} is already booked from ${clockIn.format(clash.startTime)} to ${clockIn.format(clash.endTime)} on ${dayIn.format(clash.startTime)}`,
        {
          code: 'ROOM_UNAVAILABLE',
          // The blocking booking, so the UI can offer to jump to it rather than
          // making the user hunt for what is in the way.
          details: [{
            bookingId: clash.id,
            startTime: clash.startTime,
            endTime: clash.endTime
          }]
        }
      )
    }

    try {
      return await tx.roomBooking.create({
        data: {
          startTime: data.startTime,
          endTime: data.endTime,
          room: { connect: { id: data.roomId } },
          user: { connect: { id } }
        }
      })
    } catch (err) {
      // The race the check above cannot win: someone booked the slot between
      // the findFirst and this insert. The constraint caught it, and without
      // this the caller would get a 500 for what is an ordinary conflict.
      //
      // Matched on the Postgres SQLSTATE rather than Prisma's P2039, because
      // P2039 is a generic "driver adapter error" that other failures also
      // carry; 23P01 is exclusion-violation and nothing else.
      if (isOverlapViolation(err)) {
        throw createHttpError(
          409,
          'That room was booked for those hours a moment ago. Pick another slot.',
          { code: 'ROOM_UNAVAILABLE' }
        )
      }
      throw err
    }
  })
}

export const editRoom = async (data, roomId) => {
  return await prisma.room.update({
    where:{id:roomId},
    data
})
}

export const editBooking = async (data, roomBookingId) => {
  return await prisma.roomBooking.update({
    where:{id:roomBookingId},
    data
})
}

export const deleteRoom = async (roomId) => {
  return await prisma.room.delete({
    where: {
        id: roomId},
  })
}


/**
 * One day of bookings — every room, or just one of them.
 *
 * Omit `roomId` and you get the whole day across every room, which is what the
 * availability grid draws. That is the point of this shape: the grid needs one
 * request, not one request per room.
 *
 * The status filter is notIn rather than in, and that is deliberate. A status
 * this code has never heard of counts as OCCUPIED, because the two failures are
 * not symmetric — showing a held slot as free is how two people book the same
 * room, while showing a free slot as held is merely annoying. REJECTED and
 * CANCELLED are the only two that release a slot. PENDING does NOT: a request
 * nobody has refused yet is still holding the space, and the grid draws it
 * hatched for exactly that reason.
 *
 * `user` is included because the grid labels each block with whoever holds it.
 * Without it every block on the screen renders as an em dash.
 *
 * ponytail: the day window is built in UTC while the grid reads hours in the
 * browser's timezone. The two agree across the 08:00-18:00 band the grid draws
 * for anywhere from roughly UTC-6 to UTC+10, so this is not a live defect — but
 * there is no office timezone anywhere in the config and inventing one here
 * would only move the guess. Fix it when a TZ setting exists, in this function
 * and the frontend's lib/format together, not in one of them.
 */
export const getRoomBookingsByDay = async (date, { roomId } = {}, db = prisma) => {
  const startOfDay = new Date(`${date}T00:00:00.000Z`)
  const endOfDay = new Date(`${date}T23:59:59.999Z`)

  return await db.roomBooking.findMany({
    where: {
      // Absent, not null: a `roomId: undefined` key is fine for Prisma but an
      // explicit null would search for bookings belonging to no room.
      ...(roomId == null ? {} : { roomId: Number(roomId) }),
      status: {
        notIn: ["REJECTED", "CANCELLED"]
      },
      // Overlaps the day rather than starting inside it — a booking running
      // from yesterday evening still occupies this morning.
      startTime: {
        lte: endOfDay
      },
      endTime: {
        gte: startOfDay
      }
    },
    include: {
      user: { select: { id: true, firstname: true, lastname: true } }
    },
    orderBy: {
      startTime: 'asc'
    }
  })
}

export const updateRoomBookingStatusService = async (roomBookingId, status) => {
  return await prisma.roomBooking.update({
    where: {
      id: roomBookingId
    },
    data: {
      status
    }
  })
}


export default {}