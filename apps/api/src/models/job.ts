import { Schema, model } from "mongoose";

export type JobStatus = "scheduled" | "in_progress" | "completed";

export type JobPriority = "low" | "medium" | "high" | "urgent";

export interface Job {
  id: string;
  userId: string;
  title: string;
  scheduledAt: string;
  location: string;
  status: JobStatus;
  priority: JobPriority;

  /**
   * Optimistic concurrency version.
   *
   * Starts at 1 and increments whenever a successful
   * state-changing update is committed.
   */
  version: number;
}

const jobSchema = new Schema<Job>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
    },

    // userId establishes ownership between a job and its creator.
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    scheduledAt: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed"],
      required: true,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      required: true,
    },
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
  },
  {
    timestamps: true,

    // We use our explicit `version` field instead of __v.
    versionKey: false,
  },
);

export const JobModel = model<Job>("Job", jobSchema);
