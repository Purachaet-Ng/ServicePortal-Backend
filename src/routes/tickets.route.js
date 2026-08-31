import express from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createTicketSchema,
  updateTicketStatusSchema,
  assignTicketSchema,
} from "../validators/ticket.validator.js";
import { idParams } from "../validators/common.validator.js";
import {
  ticketDashboard,
  ticketUpdateStatus,
  ticketCreate,
  ticketUpdateAssign,
} from "../controllers/tickets.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/", ticketDashboard);

router.post("/", validate({ body: createTicketSchema }), ticketCreate);

router.patch(
  "/:id/status",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT", "STAFF"),
  validate({ params: idParams, body: updateTicketStatusSchema }),
  ticketUpdateStatus,
);

router.patch(
  "/:id/assign",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ params: idParams, body: assignTicketSchema }),
  ticketUpdateAssign,
);

export default router;
