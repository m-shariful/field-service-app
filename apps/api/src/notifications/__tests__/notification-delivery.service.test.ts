import { beforeAll, describe, expect, it, vi } from "vitest";
import {
  NotificationProcessingInProgressError,
  PermanentNotificationDeliveryError,
  processNotificationDelivery,
} from "../services/notification-delivery.service";

import { randomUUID } from "node:crypto";
import { NotificationModel } from "../models/notification";

async function createQueuedNotification() {
  return NotificationModel.create({
    id: randomUUID(),
    userId: "user-1",
    type: "JOB_REMINDER",
    title: "Job reminder",
    body: "Your job is scheduled.",
    deliveryStatus: "queued",
  });
}

const job = {
  attemptsMade: 0,
  attempts: 5,
};

describe("notification delivery lifecycle", () => {
  beforeAll(async () => {
    await NotificationModel.init();
  });

  it("accepts a notification and stores provider ticket IDs", async () => {
    const notification = await createQueuedNotification();

    const deliver = vi.fn().mockResolvedValue({
      status: "accepted",
      providerTicketIds: ["ticket-1"],
    });

    const result = await processNotificationDelivery(
      notification.id,
      job,
      deliver,
    );

    expect(result).toBe("accepted");
    expect(deliver).toHaveBeenCalledOnce();

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select(
        "+deliveryStatus +deliveryAttempts +acceptedAt +providerTicketIds",
      )
      .lean();

    expect(stored?.deliveryStatus).toBe("accepted");
    expect(stored?.deliveryAttempts).toBe(1);
    expect(stored?.providerTicketIds).toEqual(["ticket-1"]);
    expect(stored?.acceptedAt).toBeInstanceOf(Date);
  });

  it("requeues a retryable failure", async () => {
    const notification = await createQueuedNotification();

    const deliver = vi
      .fn()
      .mockRejectedValue(new Error("Temporary provider failure"));

    await expect(
      processNotificationDelivery(notification.id, job, deliver),
    ).rejects.toThrow("Temporary provider failure");

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select("+deliveryStatus +processingLeaseToken")
      .lean();

    expect(stored?.deliveryStatus).toBe("queued");
    expect(stored?.processingLeaseToken).toBeUndefined();
  });

  it("marks the notification failed after the final attempt", async () => {
    const notification = await createQueuedNotification();

    const deliver = vi
      .fn()
      .mockRejectedValue(new Error("Provider unavailable"));

    const result = await processNotificationDelivery(
      notification.id,
      {
        attemptsMade: 4,
        attempts: 5,
      },
      deliver,
    );

    expect(result).toBe("failed");

    const stored = await NotificationModel.findOne({
      id: notification.id,
    })
      .select("+deliveryStatus +lastDeliveryError")
      .lean();

    expect(stored?.deliveryStatus).toBe("failed");
    expect(stored?.lastDeliveryError).toBe("Provider unavailable");
  });

  it("does not retry permanent delivery failures", async () => {
    const notification = await createQueuedNotification();

    const deliver = vi
      .fn()
      .mockRejectedValue(
        new PermanentNotificationDeliveryError("Invalid payload"),
      );

    const result = await processNotificationDelivery(
      notification.id,
      job,
      deliver,
    );

    expect(result).toBe("failed");
    expect(deliver).toHaveBeenCalledOnce();
  });

  it("does not send an already accepted notification again", async () => {
    const notification = await createQueuedNotification();

    const deliver = vi.fn().mockResolvedValue({
      status: "accepted",
      providerTicketIds: ["ticket-1"],
    });

    await processNotificationDelivery(notification.id, job, deliver);

    const duplicateResult = await processNotificationDelivery(
      notification.id,
      job,
      deliver,
    );

    expect(duplicateResult).toBe("already_processed");
    expect(deliver).toHaveBeenCalledOnce();
  });

  it("does not allow a second worker to claim an active notification", async () => {
    const notification = await createQueuedNotification();

    let releaseDelivery!: () => void;

    const deliver = vi.fn(
      () =>
        new Promise<{
          status: "accepted";
          providerTicketIds: string[];
        }>((resolve) => {
          releaseDelivery = () =>
            resolve({
              status: "accepted",
              providerTicketIds: ["ticket-1"],
            });
        }),
    );

    const firstWorker = processNotificationDelivery(
      notification.id,
      job,
      deliver,
    );

    await vi.waitFor(async () => {
      const stored = await NotificationModel.findOne({
        id: notification.id,
      })
        .select("+deliveryStatus")
        .lean();

      expect(stored?.deliveryStatus).toBe("processing");
    });

    await expect(
      processNotificationDelivery(notification.id, job, deliver),
    ).rejects.toBeInstanceOf(NotificationProcessingInProgressError);

    releaseDelivery();
    await firstWorker;

    expect(deliver).toHaveBeenCalledOnce();
  });

  it("recovers an expired processing lease", async () => {
    const notification = await createQueuedNotification();

    await NotificationModel.updateOne(
      { id: notification.id },
      {
        $set: {
          deliveryStatus: "processing",
          processingLeaseToken: "expired-token",
          processingLeaseExpiresAt: new Date(Date.now() - 60_000),
        },
      },
    );

    const deliver = vi.fn().mockResolvedValue({
      status: "accepted",
      providerTicketIds: ["ticket-recovered"],
    });

    const result = await processNotificationDelivery(
      notification.id,
      job,
      deliver,
    );

    expect(result).toBe("accepted");
    expect(deliver).toHaveBeenCalledOnce();
  });
});
