import { prisma } from '../lib/prisma.js';

export async function createTicket(payload) {
  const {
    requestTypeId,
    title,
    description,
    customFields,
    createdById,
    assignedToId,
  } = payload;

  return prisma.tickets.create({
    data: {
      requestTypeId,
      title,
      description,
      customFields,
      createdById,
      assignedToId,
    },
  });
}

export async function readAllTicket(req, res) {
  return await res.status(200).json({ message: `Read all ticket` });
}
