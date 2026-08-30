// รวมคำสั่งที่ติดต่อกับตาราง User ไว้ที่เดียว
import { prisma } from "../lib/prisma.js";

const publicUserSelect = {
  id: true,
  firstname: true,
  lastname: true,
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
