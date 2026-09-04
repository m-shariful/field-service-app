// Seed initial jobs to MongoDB

import "../bootstrap";
import "../config/dns";

import bcrypt from "bcryptjs";
import { connectToDatabase } from "../config/db";
import { JobModel } from "../models/job";
import { UserModel } from "../models/user";

const seedUser = {
  id: "user-seed-001",
  name: "Seed User",
  email: "seed@example.com",
  password: "password123",
};

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
    priority: "medium",
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

  // seed a predictable development user so seeded jobs
  // can be accessed through the authenticated API.
  let user = await UserModel.findOne({
    email: seedUser.email,
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(seedUser.password, 12);

    user = await UserModel.create({
      id: seedUser.id,
      name: seedUser.name,
      email: seedUser.email,
      passwordHash,
    });

    console.log(`Created seed user: ${seedUser.email}`);
  } else {
    console.log(`Using existing seed user: ${user.email}`);
  }

  // here jobs are scoped to their owner through userId.
  // Deleting and recreating the jobs keeps the seed operation deterministic.
  await JobModel.deleteMany({});

  const userJobs = jobs.map((job) => ({
    ...job,
    userId: user.id,
  }));

  await JobModel.insertMany(userJobs);

  console.log(`Seeded ${userJobs.length} jobs for ${user.email}`);

  process.exit(0);
}

seed().catch((error) => {
  console.error("Failed to seed jobs:", error);
  process.exit(1);
});
