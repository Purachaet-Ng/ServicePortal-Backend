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