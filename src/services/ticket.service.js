import createHttpError from "http-errors";
import { prisma } from "../lib/prisma.js";

export async function createTicket(payload) {
  const { requestTypeId, title, description, customFields, createdById } =
    payload;

  return prisma.ticket.create({
    data: {
      requestTypeId,
      title,
      description,
      customFields,
      createdById,
    },
  });
}

export async function readTicket(user) {
  const where = buildTicketWhereByRole(user);
  return prisma.ticket.findMany({
    where,
    // orderBy: { createdAt: 'desc' }, หากจะเอาล่าสุดขึ้นก่อนค่อยเปิด
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
function buildTicketWhereByRole(user) {
  switch (user.role) {
    case "ADMIN_SYSTEM":
      return {};
    case "ADMIN_DEPT":
      if (!user.departmentId) {
        throw createHttpError(400, "กรุณาส่ง departmentId สำหรับ role นี้");
      }
      return {
        requestType: {
          departmentId: user.departmentId,
        },
      };
    case "STAFF":
      if (!user.departmentId) {
        throw createHttpError(400, "กรุณาส่ง departmentId สำหรับ role นี้");
      }
      return {
        assignedToId: user.id,
      };
    default:
      throw createHttpError(403, "ไม่มีสิทธิ์เข้าถึง ticket");
  }
}

export async function updateTicket(ticketId, assignedToId) {
  console.log(ticketId, assignedToId);

  const updated = prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId },
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

  return updated;
}
