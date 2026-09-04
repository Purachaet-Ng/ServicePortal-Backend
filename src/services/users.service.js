// รวมคำสั่งที่ติดต่อกับตาราง User ไว้ที่เดียว
import { prisma } from "../lib/prisma.js";

const publicUserSelect = {
  id: true,
  firstname: true,
  lastname: true,
  phone: true,
  email: true,
  role: true,
  departmentId: true,
  createdAt: true,
};

export const findUserByEmail = async (email) => {
  return await prisma.user.findUnique({
    where: { email: email },
  });
};

export const createUser = async (userData) => {
  return await prisma.user.create({
    data: userData,
    select: publicUserSelect,
  });
};

export const findPublicUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
};

export const findUsers = async (where) => {
  return await prisma.user.findMany({
    where,
    select: publicUserSelect,
    orderBy: { id: "asc" },
  });
};

export const updateUserById = async (userId, userFieldsToUpdate) => {
  return await prisma.user.update({
    where: { id: userId },
    data: userFieldsToUpdate,
    select: publicUserSelect,
  });
};

export const deleteUserById = async (userId) => {
  return await prisma.user.delete({
    where: { id: userId },
    select: publicUserSelect,
  });
};