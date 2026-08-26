import type { Job, JobStatus } from "../models/job";

import { transitionJobStatus } from "./job-status.service";

const jobs: Job[] = [
  {
    id: "job-001",
    title: "AC Unit Inspection",
    scheduledAt: "2026-08-24T10:00:00+06:00",
    location: "Mohammadpur, Rajshahi",
    status: "scheduled",
    priority: "high",
  },
  {
    id: "job-002",
    title: "Electrical Maintenance",
    scheduledAt: "2026-08-24T14:30:00+06:00",
    location: "Rajshahi City",
    status: "in_progress",
    priority: "normal",
  },
  {
    id: "job-003",
    title: "Generator Service",
    scheduledAt: "2026-08-25T09:00:00+06:00",
    location: "Boalia, Rajshahi",
    status: "completed",
    priority: "low",
  },
];

export function getJobs(): Job[] {
  return jobs;
}

export function getJobById(id: string): Job | undefined {
  return jobs.find((job) => job.id === id);
}

export function updateJobStatus(
  id: string,
  newStatus: JobStatus,
): Job | undefined {
  const job = getJobById(id);

  if (!job) {
    throw new Error("Job not found");
  }

  // We're deliberately allowing the service to mutate the in-memory job.
  job.status = transitionJobStatus(job.status, newStatus); // This is currently our temporary in-memory persistence.

  return job;
}
// Later, when MongoDB/PostgreSQL is introduced, this updateJobStatus function will become something like:

// find job
//    ↓
// validate transition
//    ↓
// database update
//    ↓
// return updated job

// The business rule itself remains separate.
