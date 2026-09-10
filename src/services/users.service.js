// รวมคำสั่งที่ติดต่อกับตาราง User ไว้ที่เดียว
import { prisma } from "../lib/prisma.js";
import { buildPagination } from "../utils/query.js";
import createHttpError from "http-errors";

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
        departmentId: user.departmentId ?? -1,
        role: "STAFF",
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

export const findUsers = async (
  user,
  { role, departmentId, q, skip, limit, page, orderBy } = {},
) => {
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
      select: publicUserSelect,
      orderBy: orderBy ?? { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: buildPagination({ page, limit, total }) };
};

export const updateUserById = async (userId, userFieldsToUpdate) => {
  return await prisma.$transaction(async (tx) => {
    const current = await tx.user.findUnique({ where: { id: userId } });
    if (!current) throw createHttpError(404, "User not found");
    const nextRole = userFieldsToUpdate.role ?? current.role;
    const nextDepartment = userFieldsToUpdate.departmentId === undefined
      ? current.departmentId : userFieldsToUpdate.departmentId;
    if (nextRole !== "ADMIN_SYSTEM" && !nextDepartment) {
      throw createHttpError(422, "Department is required for staff and department admins");
    }
    if (nextRole !== current.role || nextDepartment !== current.departmentId) {
      const pendingRequest = await tx.inventoryRequest.findFirst({
        where: { requesterId: userId, status: { in: ["PENDING", "APPROVED"] } },
        select: { id: true },
      });
      const activeAssignment = await tx.assetAssignment.findFirst({
        where: { userId, returnedAt: null }, select: { id: true },
      });
      const replenishment = await tx.inventoryReplenishment.findFirst({
        where: { requesterId: userId, status: { in: ["PENDING", "APPROVED", "DISPATCHED"] } },
        select: { id: true },
      });
      if (pendingRequest || activeAssignment || replenishment) {
        throw createHttpError(409,
          "Complete or cancel inventory requests and return assigned assets before changing department or role",
          { code: "INVENTORY_ACCOUNT_IN_USE" });
      }
    }
    return tx.user.update({
      where: { id: userId }, data: userFieldsToUpdate, select: publicUserSelect,
    });
  }, { isolationLevel: "Serializable" });
};

export const deleteUserById = async (userId) => {
  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { _count: { select: {
          inventoryRequests: true, reviewedInventoryRequests: true,
          stockMovements: true, assetAssignments: true,
          requestedReplenishments: true, reviewedReplenishments: true, receivedReplenishments: true,
        } } },
      });
      if (!user) throw createHttpError(404, "User not found");
      if (Object.values(user._count).some((count) => count > 0)) {
        throw createHttpError(409,
          "This account has inventory records and cannot be deleted; its audit history must be retained",
          { code: "INVENTORY_ACCOUNT_IN_USE" });
      }
      return tx.user.delete({ where: { id: userId }, select: publicUserSelect });
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (error.code === "P2003") {
      throw createHttpError(409, "This account is referenced by existing records and cannot be deleted");
    }
    throw error;
  }
};
