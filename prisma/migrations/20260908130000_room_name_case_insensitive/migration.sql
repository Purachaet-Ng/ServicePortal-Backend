-- Room names become case-INsensitive, not merely unique.
--
-- The plain unique index added in 20260908120000 still let "meeting room a" sit
-- next to "Meeting Room A". Those are one room to every human who reads the
-- list and two rooms to the database, which is the exact ambiguity the previous
-- migration set out to remove.
--
-- Done with the citext column type rather than a unique index on lower(name):
-- the rule then lives in the column, so findUnique({ where: { name } }) and
-- every comparison written later inherit it. A functional index would only
-- catch writes, and Prisma cannot express one in the schema anyway — it would
-- read as drift forever.
CREATE EXTENSION IF NOT EXISTS citext;

-- This database has no case-only collisions, but a teammate's may: the last
-- migration proved duplicate names do arise in practice. Same two rules as
-- 20260908120000, partitioned by lower(name) this time, so the type change
-- below cannot fail on data nobody has looked at.

-- 1. A duplicate nobody has ever booked carries no history, so the later row
--    goes. Restricted to rows with no bookings — a room someone actually
--    reserved is never deleted to satisfy an index.
DELETE FROM "rooms" r
WHERE EXISTS (
        SELECT 1 FROM "rooms" keep
        WHERE lower(keep."name") = lower(r."name") AND keep."id" < r."id"
      )
  AND NOT EXISTS (
        SELECT 1 FROM "room_bookings" b WHERE b."room_id" = r."id"
      );

-- 2. Anything still colliding has bookings on both sides, so both rows survive
--    and the busiest keeps the familiar name. " (2)" is a placeholder an admin
--    should replace from the rooms admin page.
UPDATE "rooms"
SET "name" = "rooms"."name" || ' (' || ranked."position" || ')'
FROM (
  SELECT r."id",
         ROW_NUMBER() OVER (
           PARTITION BY lower(r."name")
           ORDER BY (
             SELECT COUNT(*) FROM "room_bookings" b WHERE b."room_id" = r."id"
           ) DESC, r."id"
         ) AS "position"
  FROM "rooms" r
) AS ranked
WHERE "rooms"."id" = ranked."id" AND ranked."position" > 1;

-- 3. The type change. Postgres rebuilds rooms_name_key as part of this, and the
--    rebuilt index uses citext's own comparisons — so the existing constraint
--    becomes the case-insensitive one. No second index is created, and none
--    should be: two unique indexes on the same column is one too many.
ALTER TABLE "rooms" ALTER COLUMN "name" TYPE citext;
