import type {
  NotificationJobData,
  NotificationJobName,
} from "../../queues/notification.queue";

import type { Queue } from "bullmq";
import { randomUUID } from "node:crypto";
import { NOTIFICATION_JOB_NAMES } from "../../queues/queue.constants";
import { NotificationModel } from "../models/notification";

type NotificationQueue = Pick<
  Queue<NotificationJobData, void, NotificationJobName>,
  "add"
>;

export interface DispatchOptions {
  batchSize?: number;
  leaseDurationMs?: number;
  now?: () => Date;
}

export interface DispatchResult {
  claimed: number;
  queued: number;
}

const DEFAULT_BATCH_SIZE = 25;
const DEFAULT_LEASE_DURATION_MS = 30_000;

/**
 * Atomically claims one eligible notification.
 *
 * The query also supports legacy notifications created before
 * deliveryStatus and nextDeliveryAt existed.
 */
async function claimNextNotification(
  now: Date,
  leaseDurationMs: number,
): Promise<{ id: string; dispatchLeaseToken: string } | null> {
  const dispatchLeaseToken = randomUUID();

  const notification = await NotificationModel.findOneAndUpdate(
    {
      $and: [
        {
          $or: [
            { deliveryStatus: "pending" },
            { deliveryStatus: { $exists: false } },
          ],
        },
        {
          $or: [
            { nextDeliveryAt: { $lte: now } },
            { nextDeliveryAt: { $exists: false } },
          ],
        },
        {
          $or: [
            { dispatchLeaseExpiresAt: null },
            { dispatchLeaseExpiresAt: { $lte: now } },
          ],
        },
      ],
    },
    {
      $set: {
        dispatchLeaseToken,
        dispatchLeaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
      },
    },
    {
      returnDocument: "after",
      sort: {
        createdAt: 1,
        _id: 1,
      },
    },
  )
    .select("+dispatchLeaseToken")
    .lean<{ id: string; dispatchLeaseToken: string }>();

  return notification;
}

/**
 * Releases a dispatch lease without changing deliveryStatus.
 *
 * This is important when Redis is unavailable: the notification
 * remains pending and can be claimed again.
 */
async function releaseDispatchLease(
  notificationId: string,
  leaseToken: string,
): Promise<void> {
  await NotificationModel.updateOne(
    {
      id: notificationId,
      dispatchLeaseToken: leaseToken,
    },
    {
      $unset: {
        dispatchLeaseToken: 1,
        dispatchLeaseExpiresAt: 1,
      },
    },
  );
}

/**
 * Marks a notification as queued only if this dispatcher still
 * owns its lease.
 */
async function markNotificationQueued(
  notificationId: string,
  leaseToken: string,
): Promise<boolean> {
  const result = await NotificationModel.updateOne(
    {
      id: notificationId,
      dispatchLeaseToken: leaseToken,
      $or: [
        { deliveryStatus: "pending" },
        { deliveryStatus: { $exists: false } },
      ],
    },
    {
      $set: {
        deliveryStatus: "queued",
      },
      $unset: {
        dispatchLeaseToken: 1,
        dispatchLeaseExpiresAt: 1,
      },
    },
  );

  return result.modifiedCount === 1;
}

/**
 * Dispatches pending notifications to BullMQ.
 *
 * BullMQ job IDs are deterministic so retries of the same
 * notification do not create multiple retained jobs.
 */
export async function dispatchPendingNotifications(
  queue: NotificationQueue,
  options: DispatchOptions = {},
): Promise<DispatchResult> {
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const leaseDurationMs = options.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const getNow = options.now ?? (() => new Date());

  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) {
    throw new Error("INVALID_DISPATCH_BATCH_SIZE");
  }

  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1_000) {
    throw new Error("INVALID_DISPATCH_LEASE_DURATION");
  }

  const result: DispatchResult = {
    claimed: 0,
    queued: 0,
  };

  while (result.claimed < batchSize) {
    const now = getNow();

    const notification = await claimNextNotification(now, leaseDurationMs);

    if (!notification) {
      break;
    }

    result.claimed += 1;

    try {
      await queue.add(
        NOTIFICATION_JOB_NAMES.DELIVER,
        {
          notificationId: notification.id,
        },
        {
          jobId: `notification-${notification.id}`,
        },
      );

      const markedQueued = await markNotificationQueued(
        notification.id,
        notification.dispatchLeaseToken,
      );

      if (markedQueued) {
        result.queued += 1;
      }
    } catch (error) {
      await releaseDispatchLease(
        notification.id,
        notification.dispatchLeaseToken,
      );

      throw error;
    }
  }

  return result;
}
