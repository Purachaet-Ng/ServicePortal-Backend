import express from "express";
import { authenticate, authorize } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import {
  createTicketSchema,
  ticketListQuery,
  updateTicketSchema,
  updateTicketStatusSchema,
} from "../validators/ticket.validator.js";
import { idParams, attachmentParams } from "../validators/common.validator.js";
import {
  ticketUpdate,
  ticketCreate,
  ticketDelete,
  getTicket,
  ListTickets,
} from "../controllers/tickets.controller.js";
import {
  requireTicketAccess,
  attachmentUpload,
  attachmentDownload,
} from "../controllers/attachments.controller.js";
import { uploadAttachments } from "../middlewares/upload.js";

const router = express.Router();

router.use(authenticate);

router.get("/",validate({query: ticketListQuery }), ListTickets);

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

// No authorize() here on purpose: who may make a given move depends on the
// ROW (assignee, creator), not just the role — assertTransition() in
// ticket.service.js is the gate. PLAN.md §6.
router.patch(
  "/:id/status",
  validate({
    params: idParams,
    body: updateTicketStatusSchema,
  }),
  ticketUpdate,
);

// Attachments. No authorize() — like GET /:id, who may touch these depends on
// the ROW (creator / assignee), and findTicketById() inside requireTicketAccess
// is the gate. The guard sits in front of uploadAttachments so a forbidden
// caller never gets to write bytes into uploads/.
router.post(
  "/:id/attachments",
  validate({ params: idParams }),
  requireTicketAccess,
  uploadAttachments,
  attachmentUpload,
);

router.get(
  "/:id/attachments/:attachmentId",
  validate({ params: attachmentParams }),
  attachmentDownload,
);

router.delete(
  "/:id",
  authorize("ADMIN_SYSTEM", "ADMIN_DEPT"),
  validate({ params: idParams }),
  ticketDelete,
);

export default router;
