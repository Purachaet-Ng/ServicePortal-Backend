import express from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
} from "../validators/ticket.validator.js";
import { idParams } from "../validators/common.validator.js";
import {
  ticketDashboard,
  ticketUpdate,
  ticketCreate,
  ticketDelete,
  getTicket,
} from "../controllers/tickets.controller.js";

const router = express.Router();

router.use(authenticate);

router.get("/", ticketDashboard);

router.get("/:id", validate({ params: idParams }), getTicket);

router.post("/", validate({ body: createTicketSchema }), ticketCreate);

router.patch(
  "/:id",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({
    params: idParams,
    body: updateTicketSchema,
  }),
  ticketUpdate,
);

router.patch(
  "/:id/status",
  authorize("STAFF"),
  validate({
    params: idParams,
    body: updateTicketStatusSchema,
  }),
  ticketUpdate,
);

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ params: idParams }),
  ticketDelete,
);

export default router;
