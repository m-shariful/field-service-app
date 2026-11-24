import { Types } from "mongoose";
import { randomUUID } from "node:crypto";

import {
  NotificationModel,
  type Notification,
  type NotificationType,
} from "../models/notification";

import {
  DeviceTokenModel,
  type DevicePlatform,
  type DeviceToken,
} from "../models/device-token";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  jobId?: string | null;
  data?: Record<string, unknown>;
  dedupeKey?: string | null;
}

export interface RegisterDeviceTokenInput {
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
}

export interface NotificationPage {
  items: Notification[];
  nextCursor: string | null;
  hasMore: boolean;
}

interface NotificationCursor {
  createdAt: string;
  objectId: string;
}

export class InvalidNotificationCursorError extends Error {
  constructor() {
    super("INVALID_NOTIFICATION_CURSOR");
    this.name = "InvalidNotificationCursorError";
  }
}

// -----------------------------------------------------------------------------
// Cursor utilities
// -----------------------------------------------------------------------------

function encodeCursor(
  notification: Notification & { _id: Types.ObjectId },
): string {
  const cursor: NotificationCursor = {
    createdAt: notification.createdAt.toISOString(),
    objectId: notification._id.toString(),
  };

  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(cursor: string): NotificationCursor {
  try {
    if (!cursor || cursor.length > 512) {
      throw new Error("Invalid cursor length");
    }

    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    ) as Partial<NotificationCursor>;

    if (
      typeof parsed.createdAt !== "string" ||
      typeof parsed.objectId !== "string"
    ) {
      throw new Error("Invalid cursor structure");
    }

    const createdAt = new Date(parsed.createdAt);

    if (
      Number.isNaN(createdAt.getTime()) ||
      !Types.ObjectId.isValid(parsed.objectId)
    ) {
      throw new Error("Invalid cursor values");
    }

    return {
      createdAt: createdAt.toISOString(),
      objectId: parsed.objectId,
    };
  } catch {
    throw new InvalidNotificationCursorError();
  }
}

// -----------------------------------------------------------------------------
// Notification creation
// -----------------------------------------------------------------------------

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification> {
  const {
    userId,
    type,
    title,
    body,
    jobId = null,
    data = {},
    dedupeKey,
  } = input;

  const normalizedDedupeKey = dedupeKey?.trim() || null;

  // Notifications without a dedupe key are independent events.
  if (!normalizedDedupeKey) {
    const notification = await NotificationModel.create({
      id: randomUUID(),
      userId,
      type,
      title,
      body,
      jobId,
      data,
      readAt: null,
    });

    return notification.toObject() as Notification;
  }

  // Atomic upsert: concurrent retries cannot create duplicate records.
  try {
    const notification = await NotificationModel.findOneAndUpdate(
      {
        userId,
        dedupeKey: normalizedDedupeKey,
      },
      {
        $setOnInsert: {
          id: randomUUID(),
          userId,
          type,
          title,
          body,
          jobId,
          data,
          dedupeKey: normalizedDedupeKey,
          readAt: null,
        },
      },
      {
        upsert: true,
        returnDocument: "after", // Mongoose v7+ uses returnDocument instead of "new: true"
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    ).lean<Notification>();

    if (!notification) {
      throw new Error("NOTIFICATION_CREATION_FAILED");
    }

    return notification;
  } catch (error) {
    // Handle the rare concurrent-upsert unique-index race.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await NotificationModel.findOne({
        userId,
        dedupeKey: normalizedDedupeKey,
      }).lean<Notification>();

      if (existing) {
        return existing;
      }
    }

    throw error;
  }
}

// -----------------------------------------------------------------------------
// Notification retrieval
// -----------------------------------------------------------------------------

export async function getNotifications(
  userId: string,
  options: {
    cursor?: string | null;
    limit?: number;
  } = {},
): Promise<NotificationPage> {
  const requestedLimit = options.limit ?? 20;

  const limit = Number.isInteger(requestedLimit)
    ? Math.min(Math.max(requestedLimit, 1), 100)
    : 20;

  const filter: Record<string, unknown> = {
    userId,
  };

  if (options.cursor) {
    const cursor = decodeCursor(options.cursor);
    const cursorDate = new Date(cursor.createdAt);
    const cursorId = new Types.ObjectId(cursor.objectId);

    // Stable descending pagination using createdAt + MongoDB _id.
    filter.$or = [
      {
        createdAt: {
          $lt: cursorDate,
        },
      },
      {
        createdAt: cursorDate,
        _id: {
          $lt: cursorId,
        },
      },
    ];
  }

  const notifications = await NotificationModel.find(filter)
    .sort({
      createdAt: -1,
      _id: -1,
    })
    .limit(limit + 1)
    .lean<Notification[]>();

  const hasMore = notifications.length > limit;
  const items = notifications.slice(0, limit);

  const lastItem = items[items.length - 1] as
    | (Notification & { _id: Types.ObjectId })
    | undefined;

  return {
    items,
    hasMore,
    nextCursor: hasMore && lastItem ? encodeCursor(lastItem) : null,
  };
}

// -----------------------------------------------------------------------------
// Unread count
// -----------------------------------------------------------------------------

export async function getUnreadCount(userId: string): Promise<number> {
  return NotificationModel.countDocuments({
    userId,
    readAt: null,
  });
}

// -----------------------------------------------------------------------------
// Mark notification as read
// -----------------------------------------------------------------------------

export async function markNotificationAsRead(
  notificationId: string,
  userId: string,
): Promise<Notification | undefined> {
  const notification = await NotificationModel.findOneAndUpdate(
    {
      id: notificationId,
      userId,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
    {
      returnDocument: "after", // Mongoose v7+ uses returnDocument instead of "new: true"
      runValidators: true,
    },
  ).lean<Notification>();

  return notification ?? undefined;
}

// -----------------------------------------------------------------------------
// Mark all notifications as read
// -----------------------------------------------------------------------------

export async function markAllNotificationsAsRead(
  userId: string,
): Promise<number> {
  const result = await NotificationModel.updateMany(
    {
      userId,
      readAt: null,
    },
    {
      $set: {
        readAt: new Date(),
      },
    },
  );

  return result.modifiedCount;
}

// -----------------------------------------------------------------------------
// Device token registration
// -----------------------------------------------------------------------------

export async function registerDeviceToken(
  userId: string,
  input: RegisterDeviceTokenInput,
): Promise<DeviceToken> {
  const { token, platform, deviceId = null } = input;

  const update = {
    $set: {
      userId,
      platform,
      provider: "expo" as const,
      deviceId,
      enabled: true,
      disabledAt: null,
      lastSeenAt: new Date(),
    },
    $setOnInsert: {
      id: randomUUID(),
    },
  };

  try {
    const device = await DeviceTokenModel.findOneAndUpdate({ token }, update, {
      upsert: true,
      returnDocument: "after", // Mongoose v7+ uses returnDocument instead of "new: true"
      runValidators: true,
      setDefaultsOnInsert: true,
    }).lean<DeviceToken>();

    if (!device) {
      throw new Error("DEVICE_TOKEN_REGISTRATION_FAILED");
    }

    return device;
  } catch (error) {
    // Retry as an update if another registration won the upsert race.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const device = await DeviceTokenModel.findOneAndUpdate(
        { token },
        update,
        {
          returnDocument: "after", // Mongoose v7+ uses returnDocument instead of "new: true"
          runValidators: true,
        },
      ).lean<DeviceToken>();

      if (device) {
        return device;
      }
    }

    throw error;
  }
}

// -----------------------------------------------------------------------------
// Device token deactivation
// -----------------------------------------------------------------------------

export async function deactivateDeviceToken(
  userId: string,
  token: string,
): Promise<boolean> {
  const result = await DeviceTokenModel.updateOne(
    {
      userId,
      token,
      enabled: true,
    },
    {
      $set: {
        enabled: false,
        disabledAt: new Date(),
      },
    },
  );

  return result.modifiedCount > 0;
}
