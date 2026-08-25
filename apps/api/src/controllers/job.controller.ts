import type { Request, Response } from "express";
import { getJobById, getJobs } from "../services/job.service";

export function listJobs(_req: Request, res: Response) {
  res.json({
    data: getJobs(),
  });
}

export function getJob(req: Request, res: Response) {
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

  const job = getJobById(id);

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
