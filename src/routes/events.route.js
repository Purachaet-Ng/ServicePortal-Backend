import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  checkInSchema,
  createEventSchema,
  eventInviteesQuery,
  inviteAttendeesSchema,
  listEventsQuery,
  updateEventSchema,
  updateRsvpSchema,
} from "../validators/event.validator.js";
import {
  addAttendees,
  cancelEvent,
  checkInEvent,
  createEventByAdmin,
  deleteEvent,
  getEvent,
  getEventQr,
  listAttendees,
  listEventInvitees,
  listEvents,
  setRsvp,
  updateEvent,
} from "../controllers/events.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", validate({ query: listEventsQuery }), listEvents);

router.get(
  "/invitees",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ query: eventInviteesQuery }),
  listEventInvitees,
);

router.get("/:id", validate({ params: idParams }), getEvent);

router.post(
  "/",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ body: createEventSchema }),
  createEventByAdmin,
);

// The controller also checks event ownership.
router.patch(
  "/:id",
  validate({ params: idParams, body: updateEventSchema }),
  updateEvent,
);

router.patch("/:id/cancel", validate({ params: idParams }), cancelEvent);

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM"),
  validate({ params: idParams }),
  deleteEvent,
);

router.get("/:id/attendees", validate({ params: idParams }), listAttendees);

router.get("/:id/qr", validate({ params: idParams }), getEventQr);

router.post(
  "/:id/check-in",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: checkInSchema }),
  checkInEvent,
);

router.post(
  "/:id/rsvp",
  validate({ params: idParams, body: updateRsvpSchema }),
  setRsvp,
);

router.post(
  "/:id/attendees",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ params: idParams, body: inviteAttendeesSchema }),
  addAttendees,
);

export default router;
