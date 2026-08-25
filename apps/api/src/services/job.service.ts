import type { Job } from "../models/job";

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
