import { prisma } from "../lib/prisma.js";

export async function findRequestTypeById(id) {
  return prisma.requestType.findUnique({ where: { id } });
}

export async function findRequestTypesByDepartment(departmentId) {
  return prisma.requestType.findMany({
    where: { departmentId },
    orderBy: { name: "asc" },
  });
}

export async function getAllRequestType() {
  return prisma.requestType.findMany({
    include: {
      department: { select: { id: true, name: true } },
    },
  });
}

export async function createRequestType(requestTypeData) {
  return prisma.requestType.create({
    data: requestTypeData,
    include: {
      department: { select: { id: true, name: true } },
    },
  });
}
