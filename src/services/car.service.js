import createHttpError from "http-errors"
import {prisma} from "../lib/prisma.js"
// Shared with room.service.js — see src/lib/reservation.js.
import { HOLDS_A_SLOT, dayIn, isOverlapViolation } from "../lib/reservation.js"

export const getAllCars = async () => {
    const cars = await prisma.car.findMany();

    return cars;
};

export const getCarById = async (carId) => {
  return await prisma.car.findUnique({
    where: {
      id: carId
    }
  })
}

export const getCarBookingById = async (carBookingId) => {
  return await prisma.carBooking.findUnique({
    where: {
      id: carBookingId
    }
  })
}

export const addCar = async (data) => {
    const car = await prisma.car.create({data});
    return car
}

/**
 * Create a car booking, refusing one that collides with a trip already holding
 * the vehicle. The mirror of addRoomBooking, and deliberately so.
 *
 * `data.status` is IGNORED, exactly as it is for rooms. createCarBookingSchema
 * requires the field and POST /cars/bookings is open to any authenticated user,
 * so honouring it would let anyone approve their own booking by sending status
 * APPROVED — approval has its own admin-gated route
 * (PATCH /cars/bookings/:id/status). Every booking starts PENDING via the schema
 * default. Do not "fix" this by passing status through.
 *
 * `db` is injectable so the overlap rules can be tested without a database.
 *
 * This check is NOT what makes overlap impossible. A transaction at Postgres'
 * default READ COMMITTED does not stop two concurrent bookings from both
 * finding the vehicle free and both inserting; only the exclusion constraint
 * car_bookings_no_overlap does. What this check is for is the MESSAGE — it names
 * the vehicle and the days, which a raw constraint violation cannot. The catch
 * below is the same answer for the rare case where the constraint gets there
 * first.
 *
 * The two must agree, and they are written to: half-open ranges either side, and
 * the same PENDING/APPROVED set in HOLDS_A_SLOT and in the constraint's WHERE
 * clause. Change one and you must change the other.
 *
 * The message counts in DAYS where the room version counts in hours. A car
 * booking is a trip — the seeded Fortuner is out for a week — so "already booked
 * from 09:00 to 17:00" would name the wrong unit and, worse, look like a clash
 * you could dodge by picking a different hour.
 */
export const addCarBooking = async (data, id, db = prisma) => {
  return await db.$transaction(async (tx) => {
    const clash = await tx.carBooking.findFirst({
      where: {
        carId: data.carId,
        status: { in: HOLDS_A_SLOT },
        startTime: { lt: data.endTime },
        endTime: { gt: data.startTime }
      },
      // The message names the vehicle, so the row has to carry it.
      include: { car: { select: { name: true } } }
    })

    if (clash) {
      const from = dayIn.format(clash.startTime)
      const to = dayIn.format(clash.endTime)

      throw createHttpError(
        409,
        from === to
          ? `${clash.car.name} is already booked on ${from}`
          : `${clash.car.name} is already booked from ${from} to ${to}`,
        {
          code: 'CAR_UNAVAILABLE',
          // The blocking booking, so the UI can say what is in the way rather
          // than making the requester hunt for it.
          details: [{
            bookingId: clash.id,
            startTime: clash.startTime,
            endTime: clash.endTime
          }]
        }
      )
    }

    try {
      return await tx.carBooking.create({
        data: {
          startTime: data.startTime,
          endTime: data.endTime,
          car: { connect: { id: data.carId } },
          user: { connect: { id } }
        }
      })
    } catch (err) {
      // The race the check above cannot win: someone took the vehicle between
      // the findFirst and this insert. The constraint caught it, and without
      // this the caller would get a 500 for an ordinary conflict.
      if (isOverlapViolation(err)) {
        throw createHttpError(
          409,
          'That vehicle was booked for those dates a moment ago. Pick another range.',
          { code: 'CAR_UNAVAILABLE' }
        )
      }
      throw err
    }
  })
}

export const editCar = async (data, carId) => {
  return await prisma.car.update({
    where:{id:carId},
    data
})
}

export const editCarBooking = async (data, carBookingId) => {
  return await prisma.carBooking.update({
    where:{id:carBookingId},
    data
})
}

export const deleteCar = async (carId) => {
  return await prisma.car.delete({
    where: {
        id: carId},
    //   data  
  })
}

export const getCarbookingByDay = async (carId, month) => {
 const startOfMonth = new Date(`${month}-01T00:00:00`)
   const endOfMonth = new Date(startOfMonth)
  endOfMonth.setMonth(endOfMonth.getMonth() + 1)
  endOfMonth.setMilliseconds(-1)
  return await prisma.carBooking.findMany({
    where: {
       carId: Number(carId),
    startTime: {
  lte: endOfMonth
},
endTime: {
  gte: startOfMonth
}
    },
    orderBy: {
      startTime: 'asc'
    }
  })
}

export const updateCarBookingStatusService = async (carBookingId, status) => {
  return await prisma.carBooking.update({
    where: {
      id: carBookingId
    },
    data: {
      status
    }
  })
}

export default {
}