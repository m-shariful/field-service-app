import "./bootstrap";
import "./config/dns";

import mongoose from "mongoose";
import { connectToDatabase } from "./config/db";
import { dispatchPendingNotifications } from "./notifications/services/notification-outbox.service";
import { createNotificationQueue } from "./queues/notification.queue";

const DEFAULT_INTERVAL_MS = 5_000;
const DEFAULT_BATCH_SIZE = 25;

function readPositiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer`);
  }

  return parsed;
}

async function main(): Promise<void> {
  const intervalMs = readPositiveInteger(
    process.env.NOTIFICATION_DISPATCH_INTERVAL_MS,
    DEFAULT_INTERVAL_MS,
    "NOTIFICATION_DISPATCH_INTERVAL_MS",
  );

  const batchSize = readPositiveInteger(
    process.env.NOTIFICATION_DISPATCH_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    "NOTIFICATION_DISPATCH_BATCH_SIZE",
  );

  await connectToDatabase();

  const queue = createNotificationQueue();

  queue.on("error", (error) => {
    console.error("[Notification Dispatcher] Queue error:", error.message);
  });

  let stopping = false;
  let shutdownPromise: Promise<void> | undefined;
  let wakeDelay: (() => void) | undefined;

  const waitForNextCycle = (): Promise<void> =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        wakeDelay = undefined;
        resolve();
      }, intervalMs);

      wakeDelay = () => {
        clearTimeout(timer);
        wakeDelay = undefined;
        resolve();
      };
    });

  const runLoop = async (): Promise<void> => {
    while (!stopping) {
      try {
        const result = await dispatchPendingNotifications(queue, {
          batchSize,
        });

        if (result.claimed > 0) {
          console.log(
            `[Notification Dispatcher] Claimed: ${result.claimed}, queued: ${result.queued}`,
          );
        }
      } catch (error) {
        console.error(
          "[Notification Dispatcher] Dispatch cycle failed:",
          error,
        );
      }

      if (!stopping) {
        await waitForNextCycle();
      }
    }
  };

  const shutdown = (): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.log("[Notification Dispatcher] Shutting down...");

      stopping = true;
      wakeDelay?.();

      // Wait for the current dispatch cycle to finish.
      await runLoopPromise;

      await queue.close();
      await mongoose.disconnect();

      console.log("[Notification Dispatcher] Shutdown complete.");
    })();

    return shutdownPromise;
  };

  const handleSignal = (signal: NodeJS.Signals): void => {
    console.log(`[Notification Dispatcher] Received ${signal}`);

    void shutdown().catch((error) => {
      console.error("[Notification Dispatcher] Shutdown failed:", error);
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  const runLoopPromise = runLoop();

  await runLoopPromise;
}

main().catch(async (error) => {
  console.error("[Notification Dispatcher] Fatal error:", error);

  await mongoose.disconnect().catch(() => undefined);

  process.exitCode = 1;
});
