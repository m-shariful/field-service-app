import type { Job } from "bullmq";

import {
  processNotificationDelivery,
  type NotificationDeliveryHandler,
} from "../notifications/services/notification-delivery.service";
import type { NotificationJobData } from "../queues/notification.queue";

export function createNotificationProcessor(
  deliver: NotificationDeliveryHandler,
) {
  return async (job: Job<NotificationJobData>): Promise<void> => {
    if (job.name !== "notification.deliver") {
      throw new Error(`UNSUPPORTED_NOTIFICATION_JOB: ${job.name}`);
    }

    const result = await processNotificationDelivery(
      job.data.notificationId,
      {
        attemptsMade: job.attemptsMade,
        attempts: job.opts.attempts ?? 1,
      },
      deliver,
    );

    console.log(
      `[Notification Processor] ${job.data.notificationId}: ${result}`,
    );
  };
}
