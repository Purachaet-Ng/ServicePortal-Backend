import { prisma } from "../lib/prisma.js";

const requestTypeSelect = {
  id: true,
  departmentId: true,
  name: true,
  description: true,
  defaultAssigneeId: true,
  formSchema: true,
};

export async function findRequestTypeById(id) {
  return prisma.requestType.findUnique({
    where: { id },
    select: requestTypeSelect,
  });
}

export async function findRequestTypeUsageById(id) {
  return prisma.requestType.findUnique({
    where: { id },
    select: {
      ...requestTypeSelect,
      _count: { select: { tickets: true } },
    },
  });
}

export async function findRequestTypesByDepartment(departmentId) {
  return prisma.requestType.findMany({
    where: { departmentId },
    select: requestTypeSelect,
    orderBy: { name: "asc" },
  });
}

export async function createRequestType(requestTypeData) {
  return prisma.requestType.create({
    data: requestTypeData,
    select: requestTypeSelect,
  });
}

export async function updateRequestTypeById(id, data) {
  return prisma.requestType.update({
    where: { id },
    data,
    select: requestTypeSelect,
  });
}

export async function deleteRequestTypeById(id) {
  return prisma.requestType.delete({
    where: { id },
    select: requestTypeSelect,
  });
}
