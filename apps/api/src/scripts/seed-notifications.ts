import "../bootstrap";
import "../config/dns";

import mongoose from "mongoose";
import { connectToDatabase } from "../config/db";
import { JobModel } from "../models/job";
import { UserModel } from "../models/user";
import { NotificationModel } from "../notifications/models/notification";

async function seedNotifications() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Notification seeding is disabled in production.");
  }

  if (process.env.ALLOW_NOTIFICATION_SEED !== "true") {
    throw new Error(
      "Set ALLOW_NOTIFICATION_SEED=true to enable notification seeding.",
    );
  }

  const emailArg = process.argv.find((arg) => arg.startsWith("--email="));
  const email = emailArg?.slice("--email=".length).trim().toLowerCase();

  if (!email) {
    throw new Error("Provide the target account using --email=your@email.com");
  }

  await connectToDatabase();

  const user = await UserModel.findOne({ email });

  if (!user) {
    throw new Error(`No account found for ${email}`);
  }

  const job = await JobModel.findOne({
    userId: user.id,
    deletedAt: null,
  }).sort({ createdAt: -1 });

  const types = ["JOB_STATUS_CHANGED", "JOB_REMINDER", "JOB_OVERDUE"] as const;

  const now = new Date();
  let created = 0;

  for (let index = 0; index < 30; index += 1) {
    const sequence = index + 1;
    const type = types[index % types.length];
    const createdAt = new Date(now.getTime() - index * 60_000);

    const result = await NotificationModel.updateOne(
      {
        userId: user.id,
        dedupeKey: `development-notification-seed:${user.id}:${sequence}`,
      },
      {
        $setOnInsert: {
          id: `dev-notification-${user.id}-${sequence}`,
          userId: user.id,
          type,
          title:
            type === "JOB_STATUS_CHANGED"
              ? "Job status updated"
              : type === "JOB_REMINDER"
                ? "Upcoming job reminder"
                : "Job requires attention",
          body:
            type === "JOB_STATUS_CHANGED"
              ? `Your job status has been updated. Test notification ${sequence}.`
              : type === "JOB_REMINDER"
                ? `You have an upcoming scheduled job. Test notification ${sequence}.`
                : `A job needs your attention. Test notification ${sequence}.`,
          jobId: type === "JOB_STATUS_CHANGED" ? (job?.id ?? null) : null,
          data: {
            developmentSeed: true,
            sequence,
          },
          readAt: sequence % 4 === 0 ? createdAt : null,
          dedupeKey: `development-notification-seed:${user.id}:${sequence}`,

          // Keep test records out of the push-delivery pipeline.
          deliveryStatus: "skipped",
          deliveryAttempts: 0,
          nextDeliveryAt: now,

          createdAt,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      created += 1;
    }
  }

  const total = await NotificationModel.countDocuments({
    userId: user.id,
    dedupeKey: {
      $regex: "^development-notification-seed:",
    },
  });

  console.log(`Notification seed completed for ${user.email}`);
  console.log(`New notifications created: ${created}`);
  console.log(`Total seeded notifications: ${total}`);
  console.log("Existing seeded records were preserved.");
}

seedNotifications()
  .catch((error) => {
    console.error("Notification seeding failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
