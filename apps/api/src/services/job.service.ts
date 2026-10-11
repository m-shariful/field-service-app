import { Job, JobModel, JobPriority, JobStatus } from "../models/job";

import { transitionJobStatus } from "./job-status.service";

export async function getJobs(userId: string): Promise<Job[]> {
  return await JobModel.find({ userId }).lean<Job[]>();
}

export async function getJobById(
  id: string,
  userId: string,
): Promise<Job | undefined> {
  return (
    (await JobModel.findOne({
      id,
      userId,
    }).lean<Job>()) || undefined
  );
}

export async function createJob(
  userId: string,
  input: {
    id?: string;
    title: string;
    scheduledAt: string;
    location: string;
    priority: JobPriority;
  },
): Promise<Job> {
  const jobId = input.id ?? `job-${Date.now()}`;

  /**
   * A client-created offline job carries its stable local id.
   *
   * This gives us an additional layer of protection:
   * even if the idempotency record is lost during a crash,
   * retrying the same create request cannot create another
   * copy of the same local mutation.
   */
  if (input.id) {
    const existingJob = await JobModel.findOne({
      id: jobId,
    });

    if (existingJob) {
      if (existingJob.userId !== userId) {
        throw new Error("JOB_ID_ALREADY_EXISTS");
      }

      const sameRequest =
        existingJob.title === input.title &&
        existingJob.scheduledAt === input.scheduledAt &&
        existingJob.location === input.location &&
        existingJob.priority === input.priority &&
        existingJob.status === "scheduled";

      if (sameRequest) {
        return existingJob.toObject();
      }

      throw new Error("JOB_ID_ALREADY_EXISTS");
    }
  }

  const job = await JobModel.create({
    id: jobId,
    userId,
    title: input.title,
    scheduledAt: input.scheduledAt,
    location: input.location,
    status: "scheduled",
    priority: input.priority,
  });

  return job.toObject();
}

export async function updateJobStatus(
  id: string,
  userId: string,
  newStatus: JobStatus,
): Promise<Job | undefined> {
  const job = await getJobById(id, userId);

  if (!job) {
    return undefined;
  }

  /**
   * Setting the same state twice is intentionally idempotent.
   *
   * This is important when the mobile app retries a mutation
   * after the server processed it but the response was lost.
   */
  if (job.status === newStatus) {
    return job;
  }

  const nextStatus = transitionJobStatus(job.status, newStatus);

  const updatedJob = await JobModel.findOneAndUpdate(
    {
      id,
      userId,
    },
    {
      $set: {
        status: nextStatus,
      },
    },
    {
      new: true,
    },
  ).lean<Job>();

  return updatedJob || undefined;
}

/**
 * STATIC DATA
 */

// import type { Job, JobStatus } from "../models/job";

// import { transitionJobStatus } from "./job-status.service";

// const jobs: Job[] = [
//   {
//     id: "job-001",
//     title: "AC Unit Inspection",
//     scheduledAt: "2026-08-24T10:00:00+06:00",
//     location: "Mohammadpur, Rajshahi",
//     status: "scheduled",
//     priority: "high",
//   },
//   {
//     id: "job-002",
//     title: "Electrical Maintenance",
//     scheduledAt: "2026-08-24T14:30:00+06:00",
//     location: "Rajshahi City",
//     status: "in_progress",
//     priority: "normal",
//   },
//   {
//     id: "job-003",
//     title: "Generator Service",
//     scheduledAt: "2026-08-25T09:00:00+06:00",
//     location: "Boalia, Rajshahi",
//     status: "completed",
//     priority: "low",
//   },
// ];

// export function getJobs(): Job[] {
//   return jobs;
// }

// export function getJobById(id: string): Job | undefined {
//   return jobs.find((job) => job.id === id);
// }

// export function updateJobStatus(
//   id: string,
//   newStatus: JobStatus,
// ): Job | undefined {
//   const job = getJobById(id);

//   if (!job) {
//     throw new Error("Job not found");
//   }

//   // We're deliberately allowing the service to mutate the in-memory job.
//   job.status = transitionJobStatus(job.status, newStatus); // This is currently our temporary in-memory persistence.

//   return job;
// }

// Later, when MongoDB/PostgreSQL is introduced, this updateJobStatus function will become something like:

// find job
//    ↓
// validate transition
//    ↓
// database update
//    ↓
// return updated job

// The business rule itself remains separate.
