import express from "express";
import { authenticate } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validate.js";
import { idParams } from "../validators/common.validator.js";
import { listNotificationsQuery } from "../validators/notification.validator.js";
import {
  getUnreadCount,
  listNotifications,
  readAllNotifications,
  readNotification,
} from "../controllers/notifications.controller.js";

const router = express.Router();

// No authorize() anywhere in this router: these are not role-gated endpoints,
// they are "your own rows only". Each controller scopes its query to
// req.user.id instead. API.md §Notifications.
router.use(authenticate);

router.get("/", validate({ query: listNotificationsQuery }), listNotifications);

router.get("/unread-count", getUnreadCount);

router.patch("/read-all", readAllNotifications);

router.patch("/:id/read", validate({ params: idParams }), readNotification);

export default router;
