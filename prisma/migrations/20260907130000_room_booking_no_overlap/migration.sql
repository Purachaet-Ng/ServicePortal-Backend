-- A room cannot be held twice for the same moment. Enforced by the DATABASE,
-- because the check in addRoomBooking cannot be: two concurrent requests at
-- Postgres' default READ COMMITTED both see the slot free and both insert.
-- Only a constraint serialises that.
--
-- btree_gist is what lets a plain equality column (room_id) sit in the same
-- GiST index as a range; without it only the range half is indexable.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- tsrange, NOT tstzrange. start_time/end_time are `timestamp without time
-- zone` (Prisma's default mapping for DateTime), so tstzrange would need an
-- implicit cast that depends on the session TimeZone — Postgres rejects that in
-- an index expression as not IMMUTABLE. Change this if the columns ever become
-- timestamptz, and change it in the same migration that converts them.
--
-- Half-open ranges, '[)': a booking ending exactly when the next begins does
-- NOT overlap. Back-to-back meetings are the normal case for a meeting room,
-- and '[]' would refuse them.
--
-- The WHERE clause is what makes this agree with the application: only PENDING
-- and APPROVED hold a slot. A REJECTED or CANCELLED booking is released and
-- must not block anyone — which is also how the pre-existing overlapping rows
-- were resolved, by cancelling the losers rather than deleting them.
ALTER TABLE "room_bookings"
  ADD CONSTRAINT "room_bookings_no_overlap"
  EXCLUDE USING gist (
    "room_id" WITH =,
    tsrange("start_time", "end_time", '[)') WITH &&
  )
  WHERE ("status" IN ('PENDING', 'APPROVED'));
