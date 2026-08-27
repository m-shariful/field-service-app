import type { Request, Response } from "express";
import { getJobById, getJobs, updateJobStatus } from "../services/job.service";

export async function listJobs(_req: Request, res: Response) {
  res.json({
    data: await getJobs(),
  });
}

export async function getJob(req: Request, res: Response) {
  const { id } = req.params;

  if (typeof id !== "string") {
    res.status(400).json({
      error: {
        code: "INVALID_JOB_ID",
        message: "Invalid job id",
      },
    });

    return;
  }

  const job = await getJobById(id);

  if (!job) {
    res.status(404).json({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      },
    });

    return;
  }

  res.json({
    data: job,
  });
}

export async function updateJobStatusController(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  if (typeof id !== "string") {
    return res.status(400).json({
      error: {
        code: "INVALID_JOB_ID",
        message: "Invalid job id",
      },
    });
  }

  if (
    status !== "scheduled" &&
    status !== "in_progress" &&
    status !== "completed"
  ) {
    return res.status(400).json({
      error: {
        code: "INVALID_STATUS",
        message: "Invalid job status",
      },
    });
  }

  let job;

  try {
    job = await updateJobStatus(id, status);
  } catch (error) {
    return res.status(400).json({
      error: {
        code: "INVALID_STATUS_TRANSITION",
        message:
          error instanceof Error
            ? error.message
            : "Invalid job status transition",
      },
    });
  }

  if (!job) {
    return res.status(404).json({
      error: {
        code: "JOB_NOT_FOUND",
        message: "Job not found",
      },
    });
  }

  return res.json({
    data: job,
  });
}
