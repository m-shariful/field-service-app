export type JobStatus = "scheduled" | "in_progress" | "completed";

export type JobPriority = "low" | "medium" | "high" | "urgent";

export interface Job {
  id: string;
  title: string;
  scheduledAt: string;
  location: string;
  status: JobStatus;
  priority: JobPriority;
}
