import { randomUUID } from "node:crypto";

import {
  NotificationModel,
  type Notification,
  type NotificationDeliveryStatus,
} from "../models/notification";

const PROCESSING_LEASE_DURATION_MS = 45_000;

const TERMINAL_STATUSES: NotificationDeliveryStatus[] = [
  "accepted",
  "delivered",
  "failed",
  "skipped",
];

export interface NotificationDeliveryResult {
  status: "accepted" | "skipped";
  providerTicketIds?: string[];
  providerTickets?: Array<{
    ticketId: string;
    deviceToken: string;
    status: "pending" | "error";
    errorCode?: string | null;
    errorMessage?: string | null;
  }>;
}

export type NotificationDeliveryHandler = (
  notification: Pick<
    Notification,
    "id" | "userId" | "title" | "body" | "data" | "type" | "jobId"
  >,
) => Promise<NotificationDeliveryResult>;

export interface NotificationJobAttempt {
  attemptsMade: number;
  attempts: number;
}

export interface ProcessNotificationOptions {
  now?: () => Date;
  leaseDurationMs?: number;
}

export class NotificationProcessingInProgressError extends Error {
  constructor() {
    super("NOTIFICATION_PROCESSING_IN_PROGRESS");
    this.name = "NotificationProcessingInProgressError";
  }
}

export class PermanentNotificationDeliveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentNotificationDeliveryError";
  }
}

type ClaimedNotification = Pick<
  Notification,
  "id" | "userId" | "title" | "body" | "data" | "type" | "jobId"
> & {
  processingLeaseToken: string;
};

async function claimNotification(
  notificationId: string,
  now: Date,
  leaseDurationMs: number,
): Promise<ClaimedNotification | null> {
  const leaseToken = randomUUID();

  const notification = await NotificationModel.findOneAndUpdate(
    {
      id: notificationId,
      $or: [
        { deliveryStatus: { $in: ["pending", "queued"] } },
        { deliveryStatus: { $exists: false } },
        {
          deliveryStatus: "processing",
          processingLeaseExpiresAt: { $lte: now },
        },
      ],
    },
    {
      $set: {
        deliveryStatus: "processing",
        processingLeaseToken: leaseToken,
        processingLeaseExpiresAt: new Date(now.getTime() + leaseDurationMs),
        lastDeliveryAttemptAt: now,
      },
      $inc: {
        deliveryAttempts: 1,
      },
    },
    {
      returnDocument: "after",
    },
  )
    .select("+deliveryStatus +deliveryAttempts +processingLeaseToken")
    .lean();

  if (!notification) {
    return null;
  }

  return {
    id: notification.id,
    userId: notification.userId,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    type: notification.type,
    processingLeaseToken: notification.processingLeaseToken!,
    jobId: notification.jobId ?? null,
  };
}

async function getExistingStatus(
  notificationId: string,
): Promise<NotificationDeliveryStatus | null> {
  const notification = await NotificationModel.findOne({
    id: notificationId,
  })
    .select("+deliveryStatus +processingLeaseExpiresAt")
    .lean();

  if (!notification) {
    return null;
  }

  if (
    notification.deliveryStatus === "processing" &&
    notification.processingLeaseExpiresAt &&
    notification.processingLeaseExpiresAt > new Date()
  ) {
    throw new NotificationProcessingInProgressError();
  }

  return notification.deliveryStatus ?? null;
}

async function releaseClaim(
  notificationId: string,
  leaseToken: string,
  status: "queued" | "failed",
  errorMessage?: string,
): Promise<void> {
  await NotificationModel.updateOne(
    {
      id: notificationId,
      processingLeaseToken: leaseToken,
      deliveryStatus: "processing",
    },
    {
      $set: {
        deliveryStatus: status,
        lastDeliveryError: errorMessage?.slice(0, 1000) ?? null,
      },
      $unset: {
        processingLeaseToken: 1,
        processingLeaseExpiresAt: 1,
      },
    },
  );
}

export async function processNotificationDelivery(
  notificationId: string,
  job: NotificationJobAttempt,
  deliver: NotificationDeliveryHandler,
  options: ProcessNotificationOptions = {},
): Promise<"accepted" | "skipped" | "failed" | "already_processed"> {
  const now = options.now ?? (() => new Date());
  const leaseDurationMs =
    options.leaseDurationMs ?? PROCESSING_LEASE_DURATION_MS;

  if (!Number.isInteger(leaseDurationMs) || leaseDurationMs < 1_000) {
    throw new Error("INVALID_PROCESSING_LEASE_DURATION");
  }

  const notification = await claimNotification(
    notificationId,
    now(),
    leaseDurationMs,
  );

  if (!notification) {
    const status = await getExistingStatus(notificationId);

    if (!status) {
      return "already_processed";
    }

    if (TERMINAL_STATUSES.includes(status)) {
      return "already_processed";
    }

    throw new NotificationProcessingInProgressError();
  }

  const leaseToken = notification.processingLeaseToken;

  try {
    const result = await deliver(notification);

    const update = await NotificationModel.updateOne(
      {
        id: notificationId,
        processingLeaseToken: leaseToken,
        deliveryStatus: "processing",
      },
      {
        $set: {
          deliveryStatus: result.status,
          acceptedAt: result.status === "accepted" ? now() : null,
          providerTicketIds: result.providerTicketIds ?? [],
          lastDeliveryError: null,
          providerTickets: result.providerTickets ?? [],
        },
        $unset: {
          processingLeaseToken: 1,
          processingLeaseExpiresAt: 1,
        },
      },
    );

    if (update.modifiedCount !== 1) {
      throw new Error("NOTIFICATION_PROCESSING_LEASE_LOST");
    }

    return result.status;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "UNKNOWN_DELIVERY_ERROR";

    const permanent = error instanceof PermanentNotificationDeliveryError;
    const finalAttempt = job.attemptsMade + 1 >= job.attempts;

    const failed = permanent || finalAttempt;

    await releaseClaim(
      notificationId,
      leaseToken,
      failed ? "failed" : "queued",
      message,
    );

    if (failed) {
      return "failed";
    }

    throw error;
  }
}
