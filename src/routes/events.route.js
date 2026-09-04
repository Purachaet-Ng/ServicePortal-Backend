import { Router } from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import {
  createEventSchema,
  inviteAttendeesSchema,
  listEventsQuery,
  updateEventSchema,
  updateRsvpSchema,
} from "../validators/event.validator.js";
import {
  addAttendees,
  cancelEvent,
  createEventByAdmin,
  getEvent,
  listAttendees,
  listEvents,
  setRsvp,
  updateEvent,
} from "../controllers/events.controller.js";

const router = Router();

router.use(authenticate);

router.get("/", validate({ query: listEventsQuery }), listEvents);

router.get("/:id", validate({ params: idParams }), getEvent);

router.post(
  "/",
  authorize("ADMIN_DEPT", "ADMIN_SYSTEM"),
  validate({ body: createEventSchema }),
  createEventByAdmin,
);

// PATCH/DELETE/invite are organizer-or-ADMIN_SYSTEM, which authorize() cannot
// express — the controller checks organizerId against req.user.
router.patch(
  "/:id",
  validate({ params: idParams, body: updateEventSchema }),
  updateEvent,
);

router.delete("/:id", validate({ params: idParams }), cancelEvent);

router.get("/:id/attendees", validate({ params: idParams }), listAttendees);

router.post(
  "/:id/rsvp",
  validate({ params: idParams, body: updateRsvpSchema }),
  setRsvp,
);

router.post(
  "/:id/attendees",
  validate({ params: idParams, body: inviteAttendeesSchema }),
  addAttendees,
);

export default router;
