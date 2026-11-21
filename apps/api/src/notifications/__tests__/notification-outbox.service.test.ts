import { beforeAll, describe, expect, it, vi } from "vitest";

import { NotificationModel } from "../models/notification";
import { dispatchPendingNotifications } from "../services/notification-outbox.service";

type MockQueue = {
  add: ReturnType<typeof vi.fn>;
};

function createMockQueue(): MockQueue {
  return {
    add: vi.fn().mockResolvedValue({}),
  };
}

async function createNotification(overrides: Record<string, unknown> = {}) {
  return NotificationModel.create({
    id: crypto.randomUUID(),
    userId: "user-1",
    type: "JOB_STATUS_CHANGED",
    title: "Job updated",
    body: "Your job status has changed.",
    ...overrides,
  });
}

describe("notification outbox dispatcher", () => {
  beforeAll(async () => {
    await NotificationModel.init();
  });

  it("claims a pending notification and enqueues a deterministic job", async () => {
    const notification = await createNotification();
    const queue = createMockQueue();

    const result = await dispatchPendingNotifications(queue as never);

    expect(result).toEqual({
      claimed: 1,
      queued: 1,
    });

    expect(queue.add).toHaveBeenCalledOnce();
    expect(queue.add).toHaveBeenCalledWith(
      "notification.deliver",
      {
        notificationId: notification.id,
      },
      {
        jobId: `notification-${notification.id}`,
      },
    );

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select("+deliveryStatus +dispatchLeaseToken")
      .lean();

    expect(stored?.deliveryStatus).toBe("queued");
    expect(stored?.dispatchLeaseToken).toBeUndefined();
  });

  it("does not dispatch notifications scheduled for the future", async () => {
    const notification = await createNotification({
      nextDeliveryAt: new Date(Date.now() + 60_000),
    });

    const queue = createMockQueue();

    const result = await dispatchPendingNotifications(queue as never);

    expect(result).toEqual({
      claimed: 0,
      queued: 0,
    });

    expect(queue.add).not.toHaveBeenCalled();

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select("+deliveryStatus")
      .lean();

    expect(stored?.deliveryStatus).toBe("pending");
  });

  it("releases the lease and keeps the notification pending when Redis fails", async () => {
    const notification = await createNotification();
    const queue = createMockQueue();

    queue.add.mockRejectedValueOnce(new Error("Redis unavailable"));

    await expect(dispatchPendingNotifications(queue as never)).rejects.toThrow(
      "Redis unavailable",
    );

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select("+deliveryStatus +dispatchLeaseToken +dispatchLeaseExpiresAt")
      .lean();

    expect(stored?.deliveryStatus).toBe("pending");
    expect(stored?.dispatchLeaseToken).toBeUndefined();
    expect(stored?.dispatchLeaseExpiresAt).toBeUndefined();
  });

  it("does not allow two concurrent dispatchers to claim the same notification", async () => {
    const notification = await createNotification();
    const queue = createMockQueue();

    const [first, second] = await Promise.all([
      dispatchPendingNotifications(queue as never, {
        batchSize: 1,
      }),
      dispatchPendingNotifications(queue as never, {
        batchSize: 1,
      }),
    ]);

    expect(first.claimed + second.claimed).toBe(1);
    expect(first.queued + second.queued).toBe(1);
    expect(queue.add).toHaveBeenCalledOnce();

    expect(queue.add).toHaveBeenCalledWith(
      "notification.deliver",
      {
        notificationId: notification.id,
      },
      {
        jobId: `notification-${notification.id}`,
      },
    );
  });

  it("can dispatch a legacy notification without delivery fields", async () => {
    const id = crypto.randomUUID();
    const now = new Date();

    await NotificationModel.collection.insertOne({
      id,
      userId: "user-1",
      type: "JOB_REMINDER",
      title: "Legacy notification",
      body: "Created before delivery state was introduced.",
      jobId: null,
      data: {},
      readAt: null,
      dedupeKey: null,
      createdAt: now,
      updatedAt: now,
    });

    const queue = createMockQueue();

    const result = await dispatchPendingNotifications(queue as never);

    expect(result).toEqual({
      claimed: 1,
      queued: 1,
    });

    const stored = await NotificationModel.findOne({ id })
      .select("+deliveryStatus +dispatchLeaseToken")
      .lean();

    expect(stored?.deliveryStatus).toBe("queued");
    expect(stored?.dispatchLeaseToken).toBeUndefined();
  });

  it("rejects invalid batch sizes", async () => {
    const queue = createMockQueue();

    await expect(
      dispatchPendingNotifications(queue as never, {
        batchSize: 0,
      }),
    ).rejects.toThrow("INVALID_DISPATCH_BATCH_SIZE");

    expect(queue.add).not.toHaveBeenCalled();
  });
});
