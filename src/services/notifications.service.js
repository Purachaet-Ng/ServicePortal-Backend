import { prisma } from "../lib/prisma.js";

const notificationSelect = {
  id: true,
  message: true,
  readAt: true,
  createdAt: true,
};

/**
 * Every read here is scoped by `userId`, and that id must come from
 * `req.user` — never from the request. API.md §Notifications.
 */
export const findNotificationsByUserId = async (userId, { unread, limit }) => {
  return await prisma.notification.findMany({
    where: {
      userId,
      ...(unread ? { readAt: null } : {}),
    },
    select: notificationSelect,
    // Rows written together share a createdAt to the millisecond (the seed
    // does exactly this), so id breaks the tie and keeps paging stable.
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
  });
};

export const countUnreadByUserId = async (userId) => {
  return await prisma.notification.count({
    where: { userId, readAt: null },
  });
};

/** Includes `userId` so the caller can check ownership before updating. */
export const findNotificationById = async (notificationId) => {
  return await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { ...notificationSelect, userId: true },
  });
};

export const markNotificationReadById = async (notificationId) => {
  return await prisma.notification.update({
    where: { id: notificationId },
    data: { readAt: new Date() },
    select: notificationSelect,
  });
};

/** Returns Prisma's `{ count }` — how many rows were still unread. */
export const markAllNotificationsReadByUserId = async (userId) => {
  return await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
};
