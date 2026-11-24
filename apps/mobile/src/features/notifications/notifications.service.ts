import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./notifications.api";
import type {
  Notification,
  NotificationListParams,
  NotificationPage,
} from "./types";

export async function getNotificationPage(
  params: NotificationListParams = {},
): Promise<NotificationPage> {
  return fetchNotifications(params);
}

export async function getUnreadNotificationCount(): Promise<number> {
  return fetchUnreadNotificationCount();
}

export async function markNotificationRead(
  notificationId: string,
): Promise<Notification> {
  return markNotificationAsRead(notificationId);
}

export async function markAllNotificationsRead(): Promise<number> {
  return markAllNotificationsAsRead();
}
