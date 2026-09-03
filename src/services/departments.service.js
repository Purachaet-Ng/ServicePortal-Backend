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

export const updateDepartmentById = async (
  departmentId,
  departmentFieldsToUpdate,
) => {
  return await prisma.department.update({
    where: { id: departmentId },
    data: departmentFieldsToUpdate,
    select: departmentSelect,
  });
};

export const findDepartmentUsageById = async (departmentId) => {
  return await prisma.department.findUnique({
    where: { id: departmentId },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          users: true,
          requestTypes: true,
        },
      },
    },
  });
};

export const deleteDepartmentById = async (departmentId) => {
  return await prisma.department.delete({
    where: { id: departmentId },
    select: departmentSelect,
  });
};

