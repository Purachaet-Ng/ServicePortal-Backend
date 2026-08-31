import createHttpError from "http-errors";
import {
  readTicket,
  createTicket,
  updateTicket,
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

export async function ticketUpdateStatus(req, res, next) {
  try {
    const ticketId = Number(req.valid.params.id);
    const { status } = req.valid.body;

    const ticket = updateTicket(ticketId, { status });
    return res.status(200).json({ ticket });
  } catch (err) {
    next(err);
  }
}

export async function ticketUpdateAssign(req, res, next) {
  try {
    const ticketId = Number(req.valid.params.id);
    const { assignedToId } = req.valid.body;

    const ticket = updateTicket(ticketId, { assignedToId });
    return res.status(200).json({ ticket });
  } catch (err) {
    next(err);
  }
}
