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
    // orderBy: { createdAt: 'desc' },
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
        throw new Error("Admin dept must belong to a department");
      }
      return {
        requestType: {
          departmentId: user.departmentId,
        },
      };
    case "STAFF":
      if (!user.departmentId) {
        throw new Error("Admin staff must belong to a department");
      }
      return {
        assignedToId: user.id,
      };
    // role อื่นค่อยเพิ่มทีหลัง
    default:
      return {};
  }
}
