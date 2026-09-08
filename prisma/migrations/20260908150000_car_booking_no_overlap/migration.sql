-- A car cannot be out on two trips at the same moment. Enforced by the
-- DATABASE, because the check in addCarBooking cannot be: two concurrent
-- requests at Postgres' default READ COMMITTED both see the vehicle free and
-- both insert. Only a constraint serialises that.
--
-- The direct analogue of room_bookings_no_overlap (20260907130000). Every
-- choice below is the same choice for the same reason; read that migration too
-- if either needs changing, and change both.
--
-- btree_gist is what lets a plain equality column (car_id) sit in the same GiST
-- index as a range; without it only the range half is indexable. Already
-- created by the room migration — IF NOT EXISTS keeps this runnable alone.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tsrange, NOT tstzrange. start_time/end_time are `timestamp without time zone`
-- (Prisma's default mapping for DateTime), so tstzrange would need an implicit
-- cast that depends on the session TimeZone — Postgres rejects that in an index
-- expression as not IMMUTABLE.
--
-- Half-open ranges, '[)': a trip returning on the 19th does NOT block one
-- leaving on the 19th. That matters more for cars than it did for rooms — a
-- vehicle handed back Friday morning is genuinely available Friday afternoon,
-- and '[]' would refuse the entire day.
--
-- The WHERE clause is what makes this agree with the application: only PENDING
-- and APPROVED hold a slot, matching HOLDS_A_SLOT in src/lib/reservation.js.
-- A REJECTED or CANCELLED trip is released and must not block anyone.
--
-- NOTE this will refuse to apply while any two live rows already overlap.
ALTER TABLE "car_bookings"
  ADD CONSTRAINT "car_bookings_no_overlap"
  EXCLUDE USING gist (
    "car_id" WITH =,
    tsrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'APPROVED'));
