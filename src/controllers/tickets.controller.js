import { readAllTicket, createTicket } from '../services/ticket.service.js';

export async function ticketCreate(req, res) {
  const payload = req.body;
  const ticket = await createTicket(payload);
  return res.status(201).json({ message: ticket });
}

export async function ticketDashboard(req, res) {
  const payload = req.body;
  const data = await readAllTicket(payload);

  return res.status(201).json(data);
}

export async function ticketById(req, res) {
  return await res.status(200).json({ message: `Get ticket by id` });
}
