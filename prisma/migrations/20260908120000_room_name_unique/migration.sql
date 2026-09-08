-- Room names become unique. A booking is read as "Meeting2, Tuesday 14:00", so
-- two rooms sharing a name make every booking on both of them ambiguous, and no
-- amount of care in the UI can tell them apart afterwards.
--
-- This database already had three duplicate pairs, so the constraint cannot go
-- on until they are resolved. The two steps below are rules rather than a list
-- of ids, so the same migration also lands on a teammate's database and on CI,
-- where the duplicates are different rows or absent entirely.

-- 1. A duplicate nobody has ever booked carries no history worth keeping, so
--    the later row goes and the lowest id survives. This is the ONLY delete
--    here, and it is deliberately restricted to rows with no bookings — a room
--    someone has actually reserved is never removed to satisfy an index.
DELETE FROM "rooms" r
WHERE EXISTS (
        SELECT 1 FROM "rooms" keep
        WHERE keep."name" = r."name" AND keep."id" < r."id"
      )
  AND NOT EXISTS (
        SELECT 1 FROM "room_bookings" b WHERE b."room_id" = r."id"
      );

-- 2. Anything still duplicated has bookings on BOTH sides, so both rows have to
--    survive and one of them needs a different name. The busiest keeps the
--    familiar one — it is the room most people mean when they say the name —
--    and the rest are suffixed. Ties break by id so the result is deterministic.
--
--    " (2)" is a placeholder, not a decision: an admin should rename these to
--    something real from the rooms admin page.
UPDATE "rooms"
SET "name" = "rooms"."name" || ' (' || ranked."position" || ')'
FROM (
  SELECT r."id",
         ROW_NUMBER() OVER (
           PARTITION BY r."name"
           ORDER BY (
             SELECT COUNT(*) FROM "room_bookings" b WHERE b."room_id" = r."id"
           ) DESC, r."id"
         ) AS "position"
  FROM "rooms" r
) AS ranked
WHERE "rooms"."id" = ranked."id" AND ranked."position" > 1;

-- 3. The constraint itself. Named rooms_name_key, which is what Prisma expects
--    for @unique on Room.name — a different name here would show as drift.
CREATE UNIQUE INDEX "rooms_name_key" ON "rooms"("name");
