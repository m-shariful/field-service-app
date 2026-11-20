import {
  deactivateNotificationDevice,
  getNotificationUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  registerNotificationDevice,
} from "../controllers/notification.controller";

import { Router } from "express";
import { requireAuth } from "../../middleware/auth";

const router = Router();

// Every notification operation requires an authenticated user.
router.use(requireAuth);

// Notification history and read state.
router.get("/", listNotifications);
router.get("/unread-count", getNotificationUnreadCount);
router.patch("/read-all", markAllNotificationsRead);
router.patch("/:id/read", markNotificationRead);

// Push device registration.
router.post("/devices", registerNotificationDevice);
router.delete("/devices", deactivateNotificationDevice);

export default router;
