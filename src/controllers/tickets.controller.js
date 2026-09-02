import createHttpError from "http-errors";
import {
  readTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  findTicketById,
} from "../services/ticket.service.js";
import { findRequestTypeById } from "../services/requestType.service.js";
import { validateCustomFields } from "../utils/schemaValidator.js";

export async function ticketCreate(req, res, next) {
  try {
    const {requestTypeId, customFields, ...rest} = req.valid.body

    const requestType = await findRequestTypeById(requestTypeId)
    if(!requestType) throw createHttpError(404,"Request type not found")
    
    
    const TicketRequestData = await createTicket({
      ...rest,
      requestTypeId,
      customFields:validateCustomFields(requestType.formSchema,customFields),
      assignedToId: rest.assignedToId ?? requestType.defaultAssigneeId,
      createdById: req.user.id,
    });
    return res.status(201).json({ TicketRequestData });
  } catch (err) {
    next(err);
  }
}

export async function ticketDashboard(req, res, next) {
  try {
    const tickets = await readTicket(req.user);

    return res.status(200).json({ tickets });
  } catch (err) {
    next(err);
  }
}

export async function ticketUpdate(req, res, next) {
  try {
    const ticketId = req.valid.params.id;
    const data = req.valid.body;

     if (data.customFields) {
      const existing = await findTicketById(ticketId);   // include: { requestType: true }
      if (!existing) throw createHttpError(404, "Ticket not found");

       data.customFields = validateCustomFields(existing.requestType.formSchema, {
        ...existing.customFields,   // PATCH merges, it does not replace
        ...data.customFields,
      });
      }
    const ticket = await updateTicket(ticketId, data);
    return res.status(200).json({ success: `Ticket ${ticketId} updated` });
  } catch (err) {
    next(err);
  }
}

export async function ticketStatusUpdate(req, res, next) {
  try {
    const ticketId = req.valid.params.id;
    const data = req.valid.body;

    const ticket = await updateFullTicket(ticketId, data);
    return res.status(200).json({ success: `Ticket ${ticketId} updated` });
  } catch (err) {
    next(err);
  }
}

export async function ticketDelete(req, res, next) {
  try {
    const ticketId = req.valid.params.id;

    const ticket = await deleteTicket(ticketId);
    return res.status(200).json({ success: `Ticket ID: ${ticketId} deleted` });
  } catch (err) {
    next(err);
  }
}
