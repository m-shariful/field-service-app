import { beforeAll, describe, expect, it } from "vitest";
import {
  deactivateDeviceToken,
  registerDeviceToken,
} from "../services/notification.service";

import { randomUUID } from "node:crypto";
import { DeviceTokenModel } from "../models/device-token";

describe("Device token service", () => {
  beforeAll(async () => {
    await DeviceTokenModel.init();
  });

  describe("registerDeviceToken", () => {
    it("registers a new device token", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      const device = await registerDeviceToken("user-1", {
        token,
        platform: "android",
        deviceId: "device-1",
      });

      expect(device.userId).toBe("user-1");
      expect(device.token).toBe(token);
      expect(device.platform).toBe("android");
      expect(device.provider).toBe("expo");
      expect(device.enabled).toBe(true);
      expect(device.disabledAt).toBeNull();
    });

    it("updates an existing token instead of creating a duplicate", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      const first = await registerDeviceToken("user-1", {
        token,
        platform: "android",
        deviceId: "device-1",
      });

      const second = await registerDeviceToken("user-1", {
        token,
        platform: "ios",
        deviceId: "device-2",
      });

      expect(second.id).toBe(first.id);
      expect(second.platform).toBe("ios");
      expect(second.deviceId).toBe("device-2");

      expect(await DeviceTokenModel.countDocuments({ token })).toBe(1);
    });

    it("reactivates a previously disabled token", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      await DeviceTokenModel.create({
        id: randomUUID(),
        userId: "user-1",
        token,
        platform: "android",
        enabled: false,
        disabledAt: new Date(),
      });

      const device = await registerDeviceToken("user-1", {
        token,
        platform: "android",
      });

      expect(device.enabled).toBe(true);
      expect(device.disabledAt).toBeNull();
    });

    it("transfers token ownership when another user registers it", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      const first = await registerDeviceToken("user-1", {
        token,
        platform: "android",
      });

      const second = await registerDeviceToken("user-2", {
        token,
        platform: "ios",
      });

      expect(second.id).toBe(first.id);
      expect(second.userId).toBe("user-2");
      expect(await DeviceTokenModel.countDocuments({ token })).toBe(1);
    });

    it("allows one user to register multiple devices", async () => {
      const first = await registerDeviceToken("user-1", {
        token: `ExponentPushToken[${randomUUID()}]`,
        platform: "android",
      });

      const second = await registerDeviceToken("user-1", {
        token: `ExponentPushToken[${randomUUID()}]`,
        platform: "ios",
      });

      expect(first.id).not.toBe(second.id);

      expect(
        await DeviceTokenModel.countDocuments({
          userId: "user-1",
          enabled: true,
        }),
      ).toBe(2);
    });
  });

  describe("deactivateDeviceToken", () => {
    it("deactivates the owner's device token", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      await registerDeviceToken("user-1", {
        token,
        platform: "android",
      });

      const result = await deactivateDeviceToken("user-1", token);

      expect(result).toBe(true);

      const device = await DeviceTokenModel.findOne({ token }).lean();

      expect(device?.enabled).toBe(false);
      expect(device?.disabledAt).toBeInstanceOf(Date);
    });

    it("does not deactivate another user's token", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      await registerDeviceToken("user-1", {
        token,
        platform: "android",
      });

      const result = await deactivateDeviceToken("user-2", token);

      expect(result).toBe(false);

      const device = await DeviceTokenModel.findOne({ token }).lean();

      expect(device?.enabled).toBe(true);
      expect(device?.disabledAt).toBeNull();
    });

    it("returns false when the token is already disabled", async () => {
      const token = `ExponentPushToken[${randomUUID()}]`;

      await registerDeviceToken("user-1", {
        token,
        platform: "android",
      });

      await deactivateDeviceToken("user-1", token);

      const result = await deactivateDeviceToken("user-1", token);

      expect(result).toBe(false);
    });
  });
});
