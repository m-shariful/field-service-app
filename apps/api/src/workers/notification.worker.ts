import { Worker, type Processor } from "bullmq";
import { getRedisConnectionOptions } from "../config/redis";
import type { NotificationJobData } from "../queues/notification.queue";
import { QUEUE_NAMES } from "../queues/queue.constants";

export function createNotificationWorker(
  processor: Processor<NotificationJobData>,
): Worker<NotificationJobData> {
  const worker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATIONS,
    processor,
    {
      connection: getRedisConnectionOptions("worker"),
      concurrency: 5,
      limiter: {
        max: 10,
        duration: 1_000,
      },
    },
  );

  worker.on("completed", (job) => {
    console.log(`[Notification Worker] Completed job: ${job.id}`);
  });

  worker.on("failed", (job, error) => {
    console.error(
      `[Notification Worker] Job ${job?.id ?? "unknown"} failed:`,
      error.message,
    );
  });

  worker.on("error", (error) => {
    console.error("[Notification Worker] Error:", error.message);
  });

  return worker;
}
