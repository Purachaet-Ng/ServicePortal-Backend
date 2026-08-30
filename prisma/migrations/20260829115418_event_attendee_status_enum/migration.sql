/*
  Warnings:

  - The `rsvp_status` column on the `event_attendees` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "EventAttendeeStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'ATTENDED', 'ABSENT');

-- AlterTable
ALTER TABLE "event_attendees" DROP COLUMN "rsvp_status",
ADD COLUMN     "rsvp_status" "EventAttendeeStatus" NOT NULL DEFAULT 'INVITED';
