import createHttpError from 'http-errors'

/**
 * What rooms and cars share about holding a slot.
 *
 * Extracted from room.service.js when cars got the same overlap guard. Copying
 * it instead would have duplicated isOverlapViolation, which encodes a piece of
 * Prisma trivia nobody would reconstruct from scratch and which must not be
 * allowed to drift between the two resources.
 */

/** The office runs on Bangkok time, and clash messages are written in it. */
export const OFFICE_TZ = 'Asia/Bangkok'

/**
 * The statuses that OCCUPY a resource. PENDING is one of them: a request nobody
 * has refused yet is still holding the space, and treating it as free is
 * precisely how two people end up in the same room at the same hour — or, for
 * cars, how two departments are promised the same van on the same Tuesday.
 *
 * This is an allow-list, while the availability reads use a deny-list, and the
 * difference is not an oversight — a status neither knows about reads as
 * OCCUPIED there (safe for a display) and as FREE here. So: adding a member to
 * ReservationStatus means revisiting THIS constant. The two lists must be kept
 * equivalent by hand, because there is no fifth status today for them to
 * disagree about.
 *
 * It must also stay equal to the WHERE clause on BOTH exclusion constraints —
 * room_bookings_no_overlap and car_bookings_no_overlap. Three places now.
 */
export const HOLDS_A_SLOT = ['PENDING', 'APPROVED']

/**
 * Postgres 23P01, exclusion_violation — either no_overlap constraint firing.
 *
 * The code is read out of the driver-adapter cause as well as the message,
 * because Prisma surfaces this as a generic P2039 and buries the real SQLSTATE.
 * Both places are checked so a change in how Prisma wraps it cannot quietly
 * turn a conflict back into a 500.
 */
export const isOverlapViolation = (err) =>
  err?.meta?.driverAdapterError?.cause?.code === '23P01' ||
  String(err?.message ?? '').includes('23P01')

/**
 * The owner withdraws their own booking.
 *
 * Here rather than duplicated across room.service.js and car.service.js because
 * this is a RULE about who may release a slot, and a rule that reads one way for
 * rooms and another for cars is a bug waiting for whoever edits only one file.
 *
 * `delegate` is prisma.roomBooking or prisma.carBooking. The two models are
 * identical in every field this touches, so the query is genuinely the same
 * query — passing the delegate is what lets it stay one function rather than a
 * switch on a string.
 *
 * The statuses you may cancel FROM are exactly HOLDS_A_SLOT, and that is not a
 * coincidence to be tidied away later: cancelling means giving the slot back, so
 * a booking that holds nothing has nothing to give. Cancelling an already
 * CANCELLED or REJECTED booking is a 409 rather than a silent no-op, because the
 * caller asked for a state change that did not happen.
 *
 * Deliberately NOT reachable through the admin /status route — see the /cancel
 * routes in reserve.route.js. This function can only ever write CANCELLED.
 */
export const cancelOwnBooking = async (delegate, id, userId) => {
  const booking = await delegate.findUnique({ where: { id } })

  if (!booking) {
    throw createHttpError(404, 'Booking not found')
  }
  // 403 and not 404: the booking exists and the caller may well be looking at
  // it — every authenticated user can already READ any booking by id.
  if (booking.userId !== userId) {
    throw createHttpError(403, 'You can only cancel your own booking')
  }
  if (!HOLDS_A_SLOT.includes(booking.status)) {
    throw createHttpError(409, `This booking is already ${booking.status.toLowerCase()}`)
  }

  return await delegate.update({
    where: { id },
    data: { status: 'CANCELLED' },
  })
}

// en-GB, not en-US: the test and the rest of the UI want "1 Sept 2026", not
// "Sep 1, 2026". Built once — a DateTimeFormat is expensive to construct.
export const clockIn = new Intl.DateTimeFormat('en-GB', {
  timeZone: OFFICE_TZ, hour: '2-digit', minute: '2-digit', hour12: false,
})
export const dayIn = new Intl.DateTimeFormat('en-GB', {
  timeZone: OFFICE_TZ, day: 'numeric', month: 'short', year: 'numeric',
})
