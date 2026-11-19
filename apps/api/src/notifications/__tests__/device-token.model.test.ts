import { beforeAll, describe, expect, it } from "vitest";

import { randomUUID } from "node:crypto";
import { DeviceTokenModel } from "../models/device-token";

describe("DeviceTokenModel", () => {
  beforeAll(async () => {
    await DeviceTokenModel.init();
  });

  it("creates an enabled Expo device token by default", async () => {
    const device = await DeviceTokenModel.create({
      id: randomUUID(),
      userId: "user-1",
      token: "ExponentPushToken[device-1]",
      platform: "android",
    });

    expect(device.enabled).toBe(true);
    expect(device.provider).toBe("expo");
    expect(device.disabledAt).toBeNull();
    expect(device.lastSeenAt).toBeInstanceOf(Date);
  });

  it("rejects an invalid platform", async () => {
    const device = new DeviceTokenModel({
      id: randomUUID(),
      userId: "user-1",
      token: "ExponentPushToken[device-2]",
      platform: "web",
    });

    await expect(device.validate()).rejects.toThrow();
  });

  it("rejects a device without required fields", async () => {
    const device = new DeviceTokenModel({
      userId: "user-1",
    });

    await expect(device.validate()).rejects.toThrow();
  });

  it("prevents the same push token from being registered twice", async () => {
    const token = "ExponentPushToken[duplicate-device]";

    await DeviceTokenModel.create({
      id: randomUUID(),
      userId: "user-1",
      token,
      platform: "android",
    });

    await expect(
      DeviceTokenModel.create({
        id: randomUUID(),
        userId: "user-2",
        token,
        platform: "ios",
      }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("allows one user to register multiple devices", async () => {
    const first = await DeviceTokenModel.create({
      id: randomUUID(),
      userId: "user-1",
      token: "ExponentPushToken[multi-device-1]",
      platform: "android",
    });

    const second = await DeviceTokenModel.create({
      id: randomUUID(),
      userId: "user-1",
      token: "ExponentPushToken[multi-device-2]",
      platform: "ios",
    });

    expect(first.userId).toBe(second.userId);
    expect(first.token).not.toBe(second.token);
  });

  it("allows a disabled device token to remain stored", async () => {
    const device = await DeviceTokenModel.create({
      id: randomUUID(),
      userId: "user-1",
      token: "ExponentPushToken[disabled-device]",
      platform: "android",
      enabled: false,
      disabledAt: new Date(),
    });

    expect(device.enabled).toBe(false);
    expect(device.disabledAt).toBeInstanceOf(Date);
  });
});
