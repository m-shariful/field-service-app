// Seed initial jobs to MongoDB

import "../bootstrap";
import "../config/dns";

import { connectToDatabase } from "../config/db";
import { JobModel } from "../models/job";

// import "dotenv/config";

const jobs = [
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

async function seed() {
  await connectToDatabase();

  await JobModel.deleteMany({});

  await JobModel.insertMany(jobs);

  console.log(`Seeded ${jobs.length} jobs`);

  process.exit(0);
}

seed().catch((error) => {
  console.error("Failed to seed jobs:", error);
  process.exit(1);
});
