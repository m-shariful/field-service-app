import "./bootstrap";
import "./config/dns";

import mongoose from "mongoose";
import { connectToDatabase } from "./config/db";
import { deliverExpoPushNotification } from "./notifications/services/expo-push.service";
import { createNotificationProcessor } from "./workers/notification.processor";
import { createNotificationWorker } from "./workers/notification.worker";

async function main(): Promise<void> {
  await connectToDatabase();

  const processor = createNotificationProcessor(deliverExpoPushNotification);

  const worker = createNotificationWorker(processor);

  await worker.waitUntilReady();

  console.log("[Notification Worker] Ready and listening for jobs.");

  let shutdownPromise: Promise<void> | undefined;

  const shutdown = (): Promise<void> => {
    if (shutdownPromise) {
      return shutdownPromise;
    }

    shutdownPromise = (async () => {
      console.log("[Notification Worker] Shutting down...");

      await worker.close();
      await mongoose.disconnect();

      console.log("[Notification Worker] Shutdown complete.");
    })();

    return shutdownPromise;
  };

  const handleSignal = (signal: NodeJS.Signals): void => {
    console.log(`[Notification Worker] Received ${signal}`);

    void shutdown().catch((error) => {
      console.error("[Notification Worker] Shutdown failed:", error);
      process.exitCode = 1;
    });
  };

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
}

main().catch(async (error) => {
  console.error("[Notification Worker] Fatal error:", error);

  await mongoose.disconnect().catch(() => undefined);

  process.exitCode = 1;
});
