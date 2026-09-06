import createHttpError from "http-errors";
import {
  countUnreadByUserId,
  findNotificationById,
  findNotificationsByUserId,
  markAllNotificationsReadByUserId,
  markNotificationReadById,
} from "../services/notifications.service.js";

export async function listNotifications(req, res, next) {
  try {
    const { unread, limit } = req.valid.query;

    const notifications = await findNotificationsByUserId(req.user.id, {
      unread,
      limit,
    });

    return res.status(200).json({ notifications });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadCount(req, res, next) {
  try {
    const count = await countUnreadByUserId(req.user.id);

    return res.status(200).json({ count });
  } catch (error) {
    next(error);
  }
}

export async function readNotification(req, res, next) {
  try {
    const notificationId = req.valid.params.id;
    const existing = await findNotificationById(notificationId);

    // Someone else's notification answers 404, not 403: a 403 would confirm
    // that this id exists and belongs to somebody.
    if (!existing || existing.userId !== req.user.id) {
      throw createHttpError(404, "Notification not found");
    }

    // Already read — answer 200 with the row untouched, so a double click
    // does not move the original read_at forward.
    if (existing.readAt) {
      const { userId, ...notification } = existing;

      return res.status(200).json({
        message: "Notification already read",
        notification,
      });
    }

    const notification = await markNotificationReadById(notificationId);

    return res.status(200).json({
      message: "Notification marked as read",
      notification,
    });
  } catch (error) {
    next(error);
  }
}

export async function readAllNotifications(req, res, next) {
  try {
    const { count } = await markAllNotificationsReadByUserId(req.user.id);

    return res.status(200).json({
      message: "All notifications marked as read",
      count,
    });
  } catch (error) {
    next(error);
  }
}
