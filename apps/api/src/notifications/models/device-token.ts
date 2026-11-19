// This lets us deliver notifications to all registered devices (ios/android) belonging to the intended user.
// The token is globally unique so that when an installation signs into another account, we can transfer its registration rather than accidentally associating one device with two users.

import { Schema, model } from "mongoose";

export type DevicePlatform = "ios" | "android";

export type PushProvider = "expo";

export interface DeviceToken {
  id: string;
  userId: string;

  token: string;
  platform: DevicePlatform;
  provider: PushProvider;

  // Optional identifier supplied by the mobile application.
  deviceId?: string | null;

  enabled: boolean;
  lastSeenAt: Date;
  disabledAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const deviceTokenSchema = new Schema<DeviceToken>(
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

    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true,
    },

    provider: {
      type: String,
      enum: ["expo"],
      required: true,
      default: "expo",
    },

    deviceId: {
      type: String,
      default: null,
    },

    enabled: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastSeenAt: {
      type: Date,
      required: true,
      default: Date.now,
    },

    disabledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

deviceTokenSchema.index({
  userId: 1,
  enabled: 1,
});

export const DeviceTokenModel = model<DeviceToken>(
  "DeviceToken",
  deviceTokenSchema,
);
