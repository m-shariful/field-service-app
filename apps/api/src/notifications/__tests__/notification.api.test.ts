import { beforeAll, describe, expect, it } from "vitest";

import { randomUUID } from "node:crypto";
import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user";
import { createAccessToken } from "../../services/auth.service";
import { DeviceTokenModel } from "../models/device-token";
import { NotificationModel } from "../models/notification";

interface TestUser {
  id: string;
  token: string;
}

async function createTestUser(): Promise<TestUser> {
  const id = `user-${randomUUID()}`;

  const user = await UserModel.create({
    id,
    name: "Test User",
    email: `${randomUUID()}@example.com`,
    passwordHash: "test-password-hash",
  });

  const token = createAccessToken({
    id: user.id,
    name: user.name,
    email: user.email,
  });

  return {
    id: user.id,
    token,
  };
}

function authenticatedRequest(token: string) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

describe("Notification API", () => {
  beforeAll(async () => {
    await UserModel.init();
    await NotificationModel.init();
    await DeviceTokenModel.init();
  });

  describe("Authentication", () => {
    it("rejects unauthenticated notification requests", async () => {
      const response = await request(app).get("/api/notifications");

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("rejects requests with an invalid access token", async () => {
      const response = await request(app)
        .get("/api/notifications")
        .set(authenticatedRequest("invalid-token"));

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/notifications", () => {
    it("returns only the authenticated user's notifications", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await NotificationModel.create({
        id: randomUUID(),
        userId: user1.id,
        type: "JOB_REMINDER",
        title: "User 1 notification",
        body: "First user's notification",
      });

      await NotificationModel.create({
        id: randomUUID(),
        userId: user2.id,
        type: "JOB_REMINDER",
        title: "User 2 notification",
        body: "Second user's notification",
      });

      const response = await request(app)
        .get("/api/notifications")
        .set(authenticatedRequest(user1.token));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].userId).toBe(user1.id);
    });

    it("supports cursor pagination", async () => {
      const user = await createTestUser();

      for (let index = 0; index < 5; index += 1) {
        await NotificationModel.create({
          id: randomUUID(),
          userId: user.id,
          type: "JOB_REMINDER",
          title: `Notification ${index}`,
          body: `Body ${index}`,
        });
      }

      const firstResponse = await request(app)
        .get("/api/notifications?limit=2")
        .set(authenticatedRequest(user.token));

      expect(firstResponse.status).toBe(200);
      expect(firstResponse.body.data.items).toHaveLength(2);
      expect(firstResponse.body.data.hasMore).toBe(true);

      const cursor = firstResponse.body.data.nextCursor;

      const secondResponse = await request(app)
        .get(`/api/notifications?limit=2&cursor=${encodeURIComponent(cursor)}`)
        .set(authenticatedRequest(user.token));

      expect(secondResponse.status).toBe(200);
      expect(secondResponse.body.data.items).toHaveLength(2);

      const firstIds = firstResponse.body.data.items.map(
        (item: { id: string }) => item.id,
      );

      const secondIds = secondResponse.body.data.items.map(
        (item: { id: string }) => item.id,
      );

      expect(secondIds.some((id: string) => firstIds.includes(id))).toBe(false);
    });

    it("rejects an invalid limit", async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get("/api/notifications?limit=101")
        .set(authenticatedRequest(user.token));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_NOTIFICATION_LIMIT");
    });

    it("rejects an invalid cursor", async () => {
      const user = await createTestUser();

      const response = await request(app)
        .get("/api/notifications?cursor=invalid-cursor")
        .set(authenticatedRequest(user.token));

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("INVALID_NOTIFICATION_CURSOR");
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("returns the authenticated user's unread count", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await NotificationModel.create([
        {
          id: randomUUID(),
          userId: user1.id,
          type: "JOB_REMINDER",
          title: "Unread 1",
          body: "First unread notification",
        },
        {
          id: randomUUID(),
          userId: user1.id,
          type: "JOB_REMINDER",
          title: "Unread 2",
          body: "Second unread notification",
        },
        {
          id: randomUUID(),
          userId: user2.id,
          type: "JOB_REMINDER",
          title: "Other user",
          body: "Another user's notification",
        },
      ]);

      const response = await request(app)
        .get("/api/notifications/unread-count")
        .set(authenticatedRequest(user1.token));

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(2);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    it("marks the authenticated user's notification as read", async () => {
      const user = await createTestUser();

      const notification = await NotificationModel.create({
        id: randomUUID(),
        userId: user.id,
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Job reminder",
      });

      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set(authenticatedRequest(user.token));

      expect(response.status).toBe(200);
      expect(response.body.data.readAt).not.toBeNull();
    });

    it("does not allow another user to mark the notification as read", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();

      const notification = await NotificationModel.create({
        id: randomUUID(),
        userId: owner.id,
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Job reminder",
      });

      const response = await request(app)
        .patch(`/api/notifications/${notification.id}/read`)
        .set(authenticatedRequest(otherUser.token));

      expect(response.status).toBe(404);

      const persisted = await NotificationModel.findOne({
        id: notification.id,
      }).lean();

      expect(persisted?.readAt).toBeNull();
    });
  });

  describe("PATCH /api/notifications/read-all", () => {
    it("marks only the authenticated user's unread notifications as read", async () => {
      const user1 = await createTestUser();
      const user2 = await createTestUser();

      await NotificationModel.create([
        {
          id: randomUUID(),
          userId: user1.id,
          type: "JOB_REMINDER",
          title: "User 1 notification",
          body: "First notification",
        },
        {
          id: randomUUID(),
          userId: user1.id,
          type: "JOB_REMINDER",
          title: "User 1 notification 2",
          body: "Second notification",
        },
        {
          id: randomUUID(),
          userId: user2.id,
          type: "JOB_REMINDER",
          title: "User 2 notification",
          body: "Other user's notification",
        },
      ]);

      const response = await request(app)
        .patch("/api/notifications/read-all")
        .set(authenticatedRequest(user1.token));

      expect(response.status).toBe(200);
      expect(response.body.data.modifiedCount).toBe(2);

      const remainingUnread = await NotificationModel.countDocuments({
        userId: user1.id,
        readAt: null,
      });

      const otherUserUnread = await NotificationModel.countDocuments({
        userId: user2.id,
        readAt: null,
      });

      expect(remainingUnread).toBe(0);
      expect(otherUserUnread).toBe(1);
    });
  });

  describe("POST /api/notifications/devices", () => {
    it("registers a valid Expo device token", async () => {
      const user = await createTestUser();
      const token = `ExponentPushToken[${randomUUID()}]`;

      const response = await request(app)
        .post("/api/notifications/devices")
        .set(authenticatedRequest(user.token))
        .send({
          token,
          platform: "android",
          deviceId: "test-device-1",
        });

      expect(response.status).toBe(200);
      expect(response.body.data.userId).toBe(user.id);
      expect(response.body.data.token).toBe(token);
      expect(response.body.data.enabled).toBe(true);
    });

    it("rejects an invalid Expo push token", async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post("/api/notifications/devices")
        .set(authenticatedRequest(user.token))
        .send({
          token: "invalid-token",
          platform: "android",
        });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe("VALIDATION_ERROR");
    });

    it("rejects an unsupported platform", async () => {
      const user = await createTestUser();

      const response = await request(app)
        .post("/api/notifications/devices")
        .set(authenticatedRequest(user.token))
        .send({
          token: `ExponentPushToken[${randomUUID()}]`,
          platform: "web",
        });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/notifications/devices", () => {
    it("deactivates the authenticated user's device token", async () => {
      const user = await createTestUser();
      const token = `ExponentPushToken[${randomUUID()}]`;

      await DeviceTokenModel.create({
        id: randomUUID(),
        userId: user.id,
        token,
        platform: "android",
      });

      const response = await request(app)
        .delete("/api/notifications/devices")
        .set(authenticatedRequest(user.token))
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.data.deactivated).toBe(true);

      const device = await DeviceTokenModel.findOne({ token }).lean();

      expect(device?.enabled).toBe(false);
    });

    it("does not deactivate another user's device token", async () => {
      const owner = await createTestUser();
      const otherUser = await createTestUser();
      const token = `ExponentPushToken[${randomUUID()}]`;

      await DeviceTokenModel.create({
        id: randomUUID(),
        userId: owner.id,
        token,
        platform: "android",
      });

      const response = await request(app)
        .delete("/api/notifications/devices")
        .set(authenticatedRequest(otherUser.token))
        .send({ token });

      expect(response.status).toBe(404);

      const device = await DeviceTokenModel.findOne({ token }).lean();

      expect(device?.enabled).toBe(true);
    });
  });
});
