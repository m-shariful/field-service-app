import { Schema, model } from "mongoose";

export type NotificationType =
  | "JOB_STATUS_CHANGED"
  | "JOB_REMINDER"
  | "JOB_OVERDUE";

export type NotificationDeliveryStatus =
  | "pending"
  | "queued"
  | "processing"
  | "delivered"
  | "failed"
  | "skipped";

export interface Notification {
  id: string;
  userId: string;

  type: NotificationType;
  title: string;
  body: string;

  // Optional reference to the job associated with this notification.
  jobId?: string | null;
  // Additional navigation/context data, never used for authorization.
  data?: Record<string, unknown>;
  readAt?: Date | null;
  // Used to prevent duplicate notifications for the same event.
  dedupeKey?: string | null;

  // Internal push-delivery state. Not part of the public API response.
  deliveryStatus: NotificationDeliveryStatus;
  deliveryAttempts: number;
  nextDeliveryAt: Date;
  lastDeliveryAttemptAt?: Date | null;
  deliveredAt?: Date | null;
  lastDeliveryError?: string | null;

  // Dispatcher lease: prevents concurrent dispatch claims.
  dispatchLeaseToken?: string | null;
  dispatchLeaseExpiresAt?: Date | null;

  // Worker lease: prevents concurrent delivery processing.
  processingLeaseToken?: string | null;
  processingLeaseExpiresAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<Notification>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },

    userId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["JOB_STATUS_CHANGED", "JOB_REMINDER", "JOB_OVERDUE"],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    jobId: {
      type: String,
      default: null,
    },

    data: {
      type: Schema.Types.Mixed,
      default: {},
    },

    readAt: {
      type: Date,
      default: null,
    },

    dedupeKey: {
      type: String,
      default: null,
    },

    deliveryStatus: {
      type: String,
      enum: [
        "pending",
        "queued",
        "processing",
        "delivered",
        "failed",
        "skipped",
      ],
      default: "pending",
      required: true,
      select: false,
    },

    deliveryAttempts: {
      type: Number,
      default: 0,
      min: 0,
      required: true,
      select: false,
    },

    nextDeliveryAt: {
      type: Date,
      default: Date.now,
      required: true,
      select: false,
    },

    lastDeliveryAttemptAt: {
      type: Date,
      default: null,
      select: false,
    },

    deliveredAt: {
      type: Date,
      default: null,
      select: false,
    },

    lastDeliveryError: {
      type: String,
      default: null,
      maxlength: 1000,
      select: false,
    },

    dispatchLeaseToken: {
      type: String,
      default: null,
      select: false,
    },

    dispatchLeaseExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },

    processingLeaseToken: {
      type: String,
      default: null,
      select: false,
    },

    processingLeaseExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Efficiently retrieve a user's notification history.
notificationSchema.index({
  userId: 1,
  createdAt: -1,
});

// Efficiently retrieve unread notifications.
notificationSchema.index({
  userId: 1,
  readAt: 1,
  createdAt: -1,
});

// A given event should produce at most one notification per user.
notificationSchema.index(
  {
    userId: 1,
    dedupeKey: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      dedupeKey: { $type: "string" },
    },
  },
);

// Dispatcher candidate lookup.
notificationSchema.index({
  deliveryStatus: 1,
  nextDeliveryAt: 1,
  createdAt: 1,
});

// Expired dispatcher lease recovery.
notificationSchema.index({
  deliveryStatus: 1,
  dispatchLeaseExpiresAt: 1,
});

// Expired worker lease recovery.
notificationSchema.index({
  deliveryStatus: 1,
  processingLeaseExpiresAt: 1,
});

export const NotificationModel = model<Notification>(
  "Notification",
  notificationSchema,
);
