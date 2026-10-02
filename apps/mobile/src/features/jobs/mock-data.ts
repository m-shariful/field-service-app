import type { Job } from "./types";

export const mockJobs: Job[] = [
  {
    id: "job-001",
    userId: "user-1727000000000",
    title: "AC Unit Inspection",
    scheduledAt: "2026-08-24T10:00:00+06:00",
    location: "Mohammadpur, Rajshahi",
    status: "scheduled",
    priority: "high",
  },
  {
    id: "job-002",
    userId: "user-1727000000000",
    title: "Electrical Maintenance",
    scheduledAt: "2026-08-24T14:30:00+06:00",
    location: "Rajshahi City",
    status: "in_progress",
    priority: "medium",
  },
  {
    id: "job-003",
    userId: "user-1727000000000",
    title: "Generator Service",
    scheduledAt: "2026-08-25T09:00:00+06:00",
    location: "Boalia, Rajshahi",
    status: "completed",
    priority: "low",
  },
];
