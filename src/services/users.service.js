// รวมคำสั่งที่ติดต่อกับตาราง User ไว้ที่เดียว
import { prisma } from "../lib/prisma.js";
import { buildPagination } from "../utils/query.js";

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

function roleCondition(user) {
  switch (user?.role) {
    case "ADMIN_SYSTEM":
      return {};
    case "ADMIN_DEPT":
      return {
          departmentId: user.departmentId,
      };
    default:
      throw createHttpError(403, "Forbidden");
  }
}


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

export const findUsers = async (user,{role,departmentId,q, skip, limit, page, orderBy}={}) => {
  const where = {
      AND: [
        roleCondition(user),
        ...(role ? [{ role }] : []),
        ...(departmentId ? [{ departmentId }] : []),
        ...(q
          ? [
              {
                OR: [
                  { firstname: { contains: q, mode: "insensitive" } },
                  { lastname: { contains: q, mode: "insensitive" } },
                ],
              },
            ]
          : []),
      ],
    };

  const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: orderBy ?? { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);
  
    return { users, meta: buildPagination({ page, limit, total }) };
  
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