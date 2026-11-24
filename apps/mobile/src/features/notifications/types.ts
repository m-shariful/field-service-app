export type NotificationType =
  | "JOB_STATUS_CHANGED"
  | "JOB_REMINDER"
  | "JOB_OVERDUE";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  jobId: string | null;
  data: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UnreadNotificationCount {
  count: number;
}

export interface NotificationListParams {
  cursor?: string | null;
  limit?: number;
}

export interface ApiSuccessResponse<T> {
  data: T;
}
