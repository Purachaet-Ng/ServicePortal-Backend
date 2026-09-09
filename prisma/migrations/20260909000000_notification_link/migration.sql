-- Frontend path to navigate to when a notification is clicked, e.g.
-- "/tickets/42" or "/events/7". Nullable: existing rows have nowhere to send
-- the user, and any notification type that never sets it just isn't clickable.
ALTER TABLE "notifications" ADD COLUMN "link" TEXT;
