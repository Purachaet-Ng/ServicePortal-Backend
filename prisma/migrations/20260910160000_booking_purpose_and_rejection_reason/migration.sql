-- Two free-text columns on both booking tables: why the resource is wanted, and
-- why a request was refused.
--
-- Nullable, and they stay nullable. Every booking that already exists was made
-- without either, so a NOT NULL column would need a backfilled default — and
-- the only honest default for "why was this rejected" is nothing at all. The
-- rule that a NEW rejection must carry a reason is enforced in
-- bookingStatusSchema (src/validators/common.validator.js), where it can apply
-- to the transition without lying about the history.
--
-- Purpose is deliberately NOT indexed. Nothing queries it — it is read on the
-- booking's own page and in the approval queue, both of which already have the
-- row in hand.

ALTER TABLE "room_bookings"
  ADD COLUMN "purpose"          TEXT,
  ADD COLUMN "rejection_reason" TEXT;

ALTER TABLE "car_bookings"
  ADD COLUMN "purpose"          TEXT,
  ADD COLUMN "rejection_reason" TEXT;
