import "../bootstrap";
import "../config/dns";

import { NotificationModel } from "../notifications/models/notification";
import { UserModel } from "../models/user";
import { connectToDatabase } from "../config/db";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Push test is disabled in production.");
  }

  if (process.env.ALLOW_NOTIFICATION_PUSH_TEST !== "true") {
    throw new Error(
      "Set ALLOW_NOTIFICATION_PUSH_TEST=true to enable this test.",
    );
  }

  const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
  const email = emailArg?.slice("--email=".length).trim().toLowerCase();

  if (!email) {
    throw new Error("Provide --email=your@email.com");
  }

  await connectToDatabase();

  const user = await UserModel.findOne({ email });

  if (!user) {
    throw new Error(`No account found for ${email}`);
  }

  const notificationId = randomUUID();

  const notification = await NotificationModel.create({
    id: notificationId,
    userId: user.id,
    type: "JOB_STATUS_CHANGED",
    title: "Field Service Push Test",
    body: "Success! Your device received a real push notification.",
    jobId: null,
    data: {
      source: "development-push-test",
    },
    dedupeKey: `push-test:${notificationId}`,
    readAt: null,
    deliveryStatus: "pending",
    deliveryAttempts: 0,
    nextDeliveryAt: new Date(),
  });

  console.log("Push test notification created.");
  console.log(`Notification ID: ${notification.id}`);
  console.log(`Target account: ${user.email}`);
  console.log("Waiting for dispatcher and worker...");
}

main()
  .catch((error) => {
    console.error("Push test failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
