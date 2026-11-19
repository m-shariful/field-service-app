import { beforeAll, describe, expect, it } from "vitest";
import type { Notification, NotificationType } from "../models/notification";

import { NotificationModel } from "../models/notification";

type NotificationInput = Pick<
  Notification,
  "userId" | "type" | "title" | "body"
> & {
  dedupeKey?: string | null;
};

describe("NotificationModel", () => {
  beforeAll(async () => {
    await NotificationModel.init();
  });

  it("creates a notification with default values", async () => {
    const notification = await NotificationModel.create({
      id: crypto.randomUUID(),
      userId: "user-1",
      type: "JOB_STATUS_CHANGED",
      title: "Job updated",
      body: "Your job status has changed.",
    });

    expect(notification.readAt).toBeNull();
    expect(notification.jobId).toBeNull();
    expect(notification.data).toEqual({});
    expect(notification.createdAt).toBeInstanceOf(Date);
  });

  it("rejects an invalid notification type", async () => {
    const notification = new NotificationModel({
      id: crypto.randomUUID(),
      userId: "user-1",
      type: "INVALID_TYPE" as NotificationType,
      title: "Invalid notification",
      body: "This should fail.",
    });

    await expect(notification.validate()).rejects.toThrow();
  });

  it("rejects a notification without required fields", async () => {
    const notification = new NotificationModel({
      userId: "user-1",
      type: "JOB_REMINDER",
    });

    await expect(notification.validate()).rejects.toThrow();
  });

  it("prevents duplicate notifications for the same user and dedupe key", async () => {
    const dedupeKey = "job-123-status-in-progress";

    const payload: NotificationInput = {
      userId: "user-1",
      type: "JOB_STATUS_CHANGED",
      title: "Job updated",
      body: "Job is now in progress.",
      dedupeKey,
    };

    await NotificationModel.create({
      ...payload,
      id: crypto.randomUUID(),
    });

    await expect(
      NotificationModel.create({
        ...payload,
        id: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({
      code: 11000,
    });
  });

  it("allows the same dedupe key for different users", async () => {
    const dedupeKey = "job-123-status-completed";

    await NotificationModel.create({
      id: crypto.randomUUID(),
      userId: "user-1",
      type: "JOB_STATUS_CHANGED",
      title: "Job completed",
      body: "Job has been completed.",
      dedupeKey,
    });

    const second = await NotificationModel.create({
      id: crypto.randomUUID(),
      userId: "user-2",
      type: "JOB_STATUS_CHANGED",
      title: "Job completed",
      body: "Job has been completed.",
      dedupeKey,
    });

    expect(second.userId).toBe("user-2");
  });

  it("allows multiple notifications without a dedupe key", async () => {
    const payload: NotificationInput = {
      userId: "user-1",
      type: "JOB_REMINDER",
      title: "Upcoming job",
      body: "You have an upcoming job.",
    };

    const first = await NotificationModel.create({
      ...payload,
      id: crypto.randomUUID(),
    });

    const second = await NotificationModel.create({
      ...payload,
      id: crypto.randomUUID(),
    });

    expect(first.id).not.toBe(second.id);
  });
});
