import { apiGet, apiPatch } from "@/api/client";
import type {
  ApiSuccessResponse,
  Notification,
  NotificationListParams,
  NotificationPage,
  UnreadNotificationCount,
} from "./types";

const BASE_PATH = "/api/notifications";

export async function fetchNotifications(
  params: NotificationListParams = {},
): Promise<NotificationPage> {
  const query = new URLSearchParams();

  if (params.cursor) {
    query.set("cursor", params.cursor);
  }

  if (params.limit !== undefined) {
    query.set("limit", String(params.limit));
  }

  const queryString = query.toString();
  const path = queryString ? `${BASE_PATH}?${queryString}` : BASE_PATH;

  const response = await apiGet<ApiSuccessResponse<NotificationPage>>(path);

  return response.data;
}

export async function fetchUnreadNotificationCount(): Promise<number> {
  const response = await apiGet<ApiSuccessResponse<UnreadNotificationCount>>(
    `${BASE_PATH}/unread-count`,
  );

  return response.data.count;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<Notification> {
  const response = await apiPatch<ApiSuccessResponse<Notification>>(
    `${BASE_PATH}/${encodeURIComponent(notificationId)}/read`,
    {},
  );

  return response.data;
}

export async function markAllNotificationsAsRead(): Promise<number> {
  const response = await apiPatch<
    ApiSuccessResponse<{ modifiedCount: number }>
  >(`${BASE_PATH}/read-all`, {});

  return response.data.modifiedCount;
}
