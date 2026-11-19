import { Schema, model } from "mongoose";

export type NotificationType =
  | "JOB_STATUS_CHANGED"
  | "JOB_REMINDER"
  | "JOB_OVERDUE";

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

export const NotificationModel = model<Notification>(
  "Notification",
  notificationSchema,
);
