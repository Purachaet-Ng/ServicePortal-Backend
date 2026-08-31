import { prisma } from "../lib/prisma.js";

const departmentSelect = {
  id: true,
  name: true,
};

export const findAllDepartments = async () => {
  return await prisma.department.findMany({
    select: departmentSelect,
    orderBy: { id: "asc" },
  });
};

export const findDepartmentById = async (departmentId) => {
  return await prisma.department.findUnique({
    where: { id: departmentId },
    select: departmentSelect,
  });
};