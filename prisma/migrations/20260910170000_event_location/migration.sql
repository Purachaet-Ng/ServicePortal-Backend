-- `location` was added to model Event in schema.prisma without a migration, so
-- the column never existed in the database. Prisma selects every scalar field
-- explicitly, which means any event query throws "column events.location does
-- not exist" until this runs.
--
-- Nullable, like rooms.location and cars.location. Existing events were created
-- without one and there is no honest default for where a past event was held.

ALTER TABLE "events" ADD COLUMN "location" TEXT;
