import { beforeAll, describe, expect, it } from "vitest";
import {
  createNotification,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../services/notification.service";

import { randomUUID } from "node:crypto";
import { NotificationModel } from "../models/notification";

describe("Notification service", () => {
  beforeAll(async () => {
    await NotificationModel.init();
  });

  describe("createNotification", () => {
    it("creates and persists a notification", async () => {
      const notification = await createNotification({
        userId: "user-1",
        type: "JOB_STATUS_CHANGED",
        title: "Job updated",
        body: "Your job is now in progress.",
        jobId: "job-1",
      });

      const persisted = await NotificationModel.findOne({
        id: notification.id,
      }).lean();

      expect(persisted).not.toBeNull();
      expect(notification.userId).toBe("user-1");
      expect(notification.jobId).toBe("job-1");
      expect(notification.readAt).toBeNull();
      expect(notification.createdAt).toBeInstanceOf(Date);
    });

    it("returns the existing notification for a duplicate dedupe key", async () => {
      const input = {
        userId: "user-1",
        type: "JOB_REMINDER" as const,
        title: "Job reminder",
        body: "Your job is scheduled soon.",
        dedupeKey: `reminder-${randomUUID()}`,
      };

      const first = await createNotification(input);

      const second = await createNotification({
        ...input,
        title: "A different title",
        body: "A different body",
      });

      expect(second.id).toBe(first.id);
      expect(second.title).toBe(first.title);

      expect(
        await NotificationModel.countDocuments({
          userId: input.userId,
        }),
      ).toBe(1);
    });

    it("allows the same dedupe key for different users", async () => {
      const dedupeKey = `shared-${randomUUID()}`;

      const first = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "First user reminder",
        dedupeKey,
      });

      const second = await createNotification({
        userId: "user-2",
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Second user reminder",
        dedupeKey,
      });

      expect(first.id).not.toBe(second.id);
      expect(first.userId).toBe("user-1");
      expect(second.userId).toBe("user-2");
    });

    it("creates independent notifications when no dedupe key is supplied", async () => {
      const input = {
        userId: "user-1",
        type: "JOB_STATUS_CHANGED" as const,
        title: "Job updated",
        body: "Your job has changed.",
      };

      const first = await createNotification(input);
      const second = await createNotification(input);

      expect(first.id).not.toBe(second.id);

      expect(
        await NotificationModel.countDocuments({
          userId: "user-1",
        }),
      ).toBe(2);
    });
  });

  describe("getNotifications", () => {
    it("returns only notifications belonging to the requested user", async () => {
      await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "User one",
        body: "First notification",
      });

      await createNotification({
        userId: "user-2",
        type: "JOB_REMINDER",
        title: "User two",
        body: "Second notification",
      });

      const result = await getNotifications("user-1");

      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.userId).toBe("user-1");
    });

    it("returns notifications in descending creation order", async () => {
      const first = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "First",
        body: "First notification",
      });

      const second = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Second",
        body: "Second notification",
      });

      const result = await getNotifications("user-1");

      expect(result.items.map((item) => item.id)).toEqual([
        second.id,
        first.id,
      ]);
    });

    it("paginates notifications without duplicates", async () => {
      const created = [];

      for (let index = 0; index < 5; index += 1) {
        created.push(
          await createNotification({
            userId: "user-1",
            type: "JOB_REMINDER",
            title: `Notification ${index}`,
            body: `Body ${index}`,
          }),
        );
      }

      const firstPage = await getNotifications("user-1", {
        limit: 2,
      });

      expect(firstPage.items).toHaveLength(2);
      expect(firstPage.hasMore).toBe(true);
      expect(firstPage.nextCursor).not.toBeNull();

      const secondPage = await getNotifications("user-1", {
        limit: 2,
        cursor: firstPage.nextCursor,
      });

      expect(secondPage.items).toHaveLength(2);
      expect(secondPage.hasMore).toBe(true);

      const thirdPage = await getNotifications("user-1", {
        limit: 2,
        cursor: secondPage.nextCursor,
      });

      expect(thirdPage.items).toHaveLength(1);
      expect(thirdPage.hasMore).toBe(false);
      expect(thirdPage.nextCursor).toBeNull();

      const allIds = [
        ...firstPage.items,
        ...secondPage.items,
        ...thirdPage.items,
      ].map((item) => item.id);

      expect(new Set(allIds).size).toBe(5);
      expect(new Set(allIds)).toEqual(new Set(created.map((item) => item.id)));
    });

    it("rejects an invalid cursor", async () => {
      await expect(
        getNotifications("user-1", {
          cursor: "not-a-valid-cursor",
        }),
      ).rejects.toThrow("INVALID_NOTIFICATION_CURSOR");
    });

    it("clamps the requested page size to the supported maximum", async () => {
      for (let index = 0; index < 3; index += 1) {
        await createNotification({
          userId: "user-1",
          type: "JOB_REMINDER",
          title: `Notification ${index}`,
          body: `Body ${index}`,
        });
      }

      const result = await getNotifications("user-1", {
        limit: 1000,
      });

      expect(result.items).toHaveLength(3);
    });
  });

  describe("read state", () => {
    it("returns the unread notification count for a user", async () => {
      await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder 1",
        body: "First reminder",
      });

      await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder 2",
        body: "Second reminder",
      });

      await createNotification({
        userId: "user-2",
        type: "JOB_REMINDER",
        title: "Other user reminder",
        body: "Another reminder",
      });

      expect(await getUnreadCount("user-1")).toBe(2);
      expect(await getUnreadCount("user-2")).toBe(1);
    });

    it("marks only the owner's notification as read", async () => {
      const notification = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Your job is scheduled soon.",
      });

      const result = await markNotificationAsRead(notification.id, "user-1");

      expect(result?.readAt).toBeInstanceOf(Date);
      expect(await getUnreadCount("user-1")).toBe(0);
    });

    it("does not allow another user to mark a notification as read", async () => {
      const notification = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Your job is scheduled soon.",
      });

      const result = await markNotificationAsRead(notification.id, "user-2");

      expect(result).toBeUndefined();
      expect(await getUnreadCount("user-1")).toBe(1);
    });

    it("marks all unread notifications as read for the requested user only", async () => {
      await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder 1",
        body: "First reminder",
      });

      await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder 2",
        body: "Second reminder",
      });

      await createNotification({
        userId: "user-2",
        type: "JOB_REMINDER",
        title: "Other reminder",
        body: "Another user's reminder",
      });

      const modifiedCount = await markAllNotificationsAsRead("user-1");

      expect(modifiedCount).toBe(2);
      expect(await getUnreadCount("user-1")).toBe(0);
      expect(await getUnreadCount("user-2")).toBe(1);
    });

    it("does not modify already-read notifications when marking all as read", async () => {
      const notification = await createNotification({
        userId: "user-1",
        type: "JOB_REMINDER",
        title: "Reminder",
        body: "Your job is scheduled soon.",
      });

      await markNotificationAsRead(notification.id, "user-1");

      const modifiedCount = await markAllNotificationsAsRead("user-1");

      expect(modifiedCount).toBe(0);
    });
  });
});
