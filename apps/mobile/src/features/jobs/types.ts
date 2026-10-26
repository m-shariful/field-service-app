import type { SyncStatus } from "@/db/types";

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
  createdAt: string;
  updatedAt: string;

  /**
   * Null means this is a locally created job that
   * has not yet received a server revision.
   */
  version: number | null;

  syncStatus?: SyncStatus;
}
