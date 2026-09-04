import createHttpError from "http-errors";
import {
  readTicket,
  createTicket,
  updateTicket,
  deleteTicket,
  findTicketById,
  assertTransition,
} from "../services/ticket.service.js";
import { findRequestTypeById } from "../services/requestType.service.js";
import { findPublicUserById } from "../services/users.service.js";
import { validateCustomFields } from "../utils/schemaValidator.js";
import {
  notifyTicketCreated,
  notifyTicketUpdated,
} from "../services/notifications.service.js";

export async function ticketCreate(req, res, next) {
  try {
    const {requestTypeId, customFields, ...rest} = req.valid.body

    const requestType = await findRequestTypeById(requestTypeId)
    if(!requestType) throw createHttpError(404,"Request type not found")
    
    
    // request_types.default_assignee_id has no FK behind it (see the schema),
    // so it can point at a user who has since been deleted. tickets.assigned_to
    // DOES have one — handing it a stale id turns a valid ticket into a 500.
    // An unresolvable default means unassigned, never a failed create.
    // ponytail: "deleted" is the only inactive there is — users have no
    // soft-delete column (doc/API.md G05); widen this check if they get one.
    const defaultAssignee = requestType.defaultAssigneeId
      ? await findPublicUserById(requestType.defaultAssigneeId)
      : null;

    const ticket = await createTicket({
      ...rest,
      requestTypeId,
      customFields:validateCustomFields(requestType.formSchema,customFields),
      assignedToId: defaultAssignee?.id ?? null,
      createdById: req.user.id,
    });

    // After the create, and it swallows its own errors — a failed
    // notification must not turn a created ticket into a 500.
    await notifyTicketCreated({
      ticket,
      departmentId: requestType.departmentId,
      actor: req.user,
    });

    // The created row, unwrapped — same shape as GET /:id and PATCH.
    return res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function ListTickets(req, res, next) {
  try {
    const { tickets, meta } = await readTicket(req.user, req.valid.query);

    return res.status(200).json({ tickets, meta });
  } catch (err) {
    next(err);
  }
}

export async function ticketUpdate(req, res, next) {
  try {
    const ticketId = req.valid.params.id;
    const data = req.valid.body;

    // Read the row BEFORE the update, always. The customFields merge below
    // needs it, and so does the notification fan-out: it compares before and
    // after so a PATCH that repeats the current status notifies nobody.
    // findTicketById throws 404 for an unknown id, 403 for someone else's.
    const before = await findTicketById(ticketId, req.user);   // 403s if it is not theirs

    // The lifecycle gate for BOTH PATCH routes — /:id can carry a status too.
    assertTransition(before, data.status, req.user);

    if (data.customFields) {
      data.customFields = validateCustomFields(before.requestType.formSchema, {
        ...before.customFields,   // PATCH merges, it does not replace
        ...data.customFields,
      });
    }

    const ticket = await updateTicket(ticketId, data);

    // After the update and never in front of it — this must not be able to
    // fail a change that already committed. notifyTicketUpdated swallows its
    // own errors.
    await notifyTicketUpdated({ before, after: ticket, actorId: req.user.id });

    // The updated row, not a message — the UI would otherwise have to re-GET
    // it. Single-resource responses are unwrapped (API.md → Conventions).
    return res.status(200).json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function ticketDelete(req, res, next) {
  try {
    const ticketId = req.valid.params.id;

    const ticket = await deleteTicket(ticketId, req.user);
    return res.status(200).json({ success: `Ticket ID: ${ticketId} deleted` });
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req,res,next) {
  try {
    const {id} =req.valid.params
    const ticket = await findTicketById(id, req.user)

    // Unwrapped, same as PATCH — one shape per resource (API.md → Conventions).
    res.status(200).json(ticket)
  } catch (error) {
    next(error)
  }
  
}