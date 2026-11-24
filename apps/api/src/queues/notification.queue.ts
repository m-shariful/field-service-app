import {
  NOTIFICATION_JOB_NAMES,
  NOTIFICATION_QUEUE_DEFAULT_OPTIONS,
  QUEUE_NAMES,
} from "./queue.constants";

import { Queue } from "bullmq";
import { getRedisConnectionOptions } from "../config/redis";

export interface NotificationJobData {
  notificationId: string;
}

export type NotificationJobName =
  (typeof NOTIFICATION_JOB_NAMES)[keyof typeof NOTIFICATION_JOB_NAMES];

export function createNotificationQueue(): Queue<
  NotificationJobData,
  void,
  NotificationJobName
> {
  return new Queue<NotificationJobData, void, NotificationJobName>(
    QUEUE_NAMES.NOTIFICATIONS,
    {
      connection: getRedisConnectionOptions("producer"),
      defaultJobOptions: NOTIFICATION_QUEUE_DEFAULT_OPTIONS,
    },
  );
}
