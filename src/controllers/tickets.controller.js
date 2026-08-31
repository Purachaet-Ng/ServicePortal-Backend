import { readTicket, createTicket } from "../services/ticket.service.js";

export async function ticketCreate(req, res, next) {
  try {
    const ticket = await createTicket(req.body);
    return res.status(201).json({ message: ticket });
  } catch (err) {
    next(err);
  }
}

export async function ticketDashboard(req, res, next) {
  const user = {
    id: Number(req.query.userId),
    role: req.query.role,
    departmentId: req.query.departmentId
      ? Number(req.query.departmentId)
      : null,
  };

  const ticket = await readTicket(user);
  res.json({ ticket });
}

export async function ticketById(req, res) {
  return await res.status(200).json({ message: `Get ticket by id` });
}
