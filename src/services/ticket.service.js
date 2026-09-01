import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";

export async function createTicket(TicketRequestData) {
  const {
    requestTypeId,
    title,
    description,
    priority,
    customFields,
    createdById,
  } = TicketRequestData;

  return prisma.ticket.create({
    data: {
      requestTypeId,
      title,
      description,
      priority,
      customFields,
      createdById,
    },
  });
}

export async function readTicket(user) {
  const where = roleCondition(user);

  return await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      requestType: { select: { id: true, name: true, departmentId: true } },
      createdBy: { select: { id: true, firstname: true, lastname: true } },
      assignedTo: { select: { id: true, firstname: true, lastname: true } },
    },
  });
}

function roleCondition(user) {
  switch (user.role) {
    case "ADMIN_SYSTEM":
      return {};
    case "ADMIN_DEPT":
      return {
        requestType: {
          departmentId: user.departmentId,
        },
      };
    case "STAFF":
      return {
        OR: [{ createdById: user.id }, { assignedToId: user.id }],
      };
    default:
      throw createHttpError(403, "Forbidden");
  }
}

export async function updateTicket(ticketId, data) {
  await checkTicket(ticketId);

  return prisma.ticket.update({
    where: { id: ticketId },
    data,
    include: {
      requestType: {
        select: { id: true, name: true, departmentId: true },
      },
      createdBy: {
        select: { id: true, firstname: true, lastname: true },
      },
      assignedTo: {
        select: { id: true, firstname: true, lastname: true },
      },
    },
  });
}

export async function deleteTicket(ticketId) {
  await checkTicket(ticketId);

  return prisma.ticket.delete({
    where: { id: ticketId },
    include: {
      requestType: {
        select: { id: true, name: true, departmentId: true },
      },
      createdBy: {
        select: { id: true, firstname: true, lastname: true },
      },
      assignedTo: {
        select: { id: true, firstname: true, lastname: true },
      },
    },
  });
}

async function checkTicket(ticketId) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
  });

  if (!ticket) {
    throw createHttpError(404, "Ticket not found");
  }

  return ticket;
}
