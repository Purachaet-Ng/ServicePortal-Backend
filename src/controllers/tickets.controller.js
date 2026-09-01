import createHttpError from "http-errors";
import {
  readTicket,
  createTicket,
  updateTicket,
  deleteTicket,
} from "../services/ticket.service.js";

export async function ticketCreate(req, res, next) {
  try {
    const TicketRequestData = await createTicket({
      ...req.valid.body,
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
    const userRole = req.user.role;

    const ticket = await updateTicket(ticketId, userRole, data);
    return res.status(200).json({ success: `Udated`, user: user });
  } catch (err) {
    next(err);
  }
}

// export async function ticketUpdateAssign(req, res, next) {
//   try {
//     const ticketId = Number(req.valid.params.id);
//     const { assignedToId } = req.valid.body;

//     const ticket = updateTicket(ticketId, { assignedToId });
//     return res
//       .status(200)
//       .json({ success: `Ticket ID: ${ticketId} assign to ${assignedToId}` });
//   } catch (err) {
//     next(err);
//   }
// }

export async function ticketDelete(req, res, next) {
  try {
    const ticketId = req.valid.params.id;

    const ticket = await deleteTicket(ticketId);
    return res.status(200).json({ success: `Ticket ID: ${ticketId} deleted` });
  } catch (err) {
    next(err);
  }
}
