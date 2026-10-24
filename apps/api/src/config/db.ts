import mongoose from "mongoose";
import { backfillJobVersions } from "../services/job-version-migration.service";

export async function connectToDatabase(): Promise<void> {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is not configured");
  }

  try {
    await mongoose.connect(mongoUri);

    console.log("Connected to MongoDB");

    // Run the job version migration after connecting to the database
    await backfillJobVersions();
  } catch (error) {
    console.error("Failed to initialize MongoDB:", error);
    throw error;
  }
}
