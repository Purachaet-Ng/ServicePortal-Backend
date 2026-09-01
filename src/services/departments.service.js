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

export const findDepartmentByName = async (departmentName) => {
  return await prisma.department.findUnique({
    where: { name: departmentName },
    select: departmentSelect,
  });
};

export const createDepartment = async (departmentData) => {
  return await prisma.department.create({
    data: departmentData,
    select: departmentSelect,
  });
};