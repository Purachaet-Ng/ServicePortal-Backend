import { cancelMyBooking, getMyBookings, getPendingBookings } from '../services/booking.service.js'

/**
 * GET /reserves/bookings/mine
 *
 * No id in the path and no query params: the token IS the filter. A user cannot
 * ask for somebody else's list, because there is nowhere to say whose list they
 * want.
 */
export const getMyBookingsController = async (req, res, next) => {
  try {
    const bookings = await getMyBookings(req.user.id)

    res.status(200).json({
      success: true,
      data: bookings,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * GET /reserves/bookings/pending — the approval queue.
 *
 * Route-gated to ADMIN_DEPT / ADMIN_SYSTEM, the same pair that may write a
 * status. No params: an admin's queue is every pending booking there is.
 */
export const getPendingBookingsController = async (req, res, next) => {
  try {
    const bookings = await getPendingBookings()

    res.status(200).json({
      success: true,
      data: bookings,
    })
  } catch (error) {
    next(error)
  }
}

/**
 * PATCH /reserves/{rooms,cars}/bookings/:id/cancel
 *
 * `type` is bound by the route, not read from the request, so there is no way
 * for a caller to aim a room cancel at the car table.
 */
export const cancelBookingController = (type) => async (req, res, next) => {
  try {
    const booking = await cancelMyBooking(type, req.valid.params.id, req.user.id)

    res.status(200).json({
      success: true,
      data: booking,
    })
  } catch (error) {
    next(error)
  }
}
