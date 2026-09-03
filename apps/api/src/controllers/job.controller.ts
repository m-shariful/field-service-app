import type { Request, Response } from "express";
import {
  createJob,
  getJobById,
  getJobs,
  updateJobStatus,
} from "../services/job.service";
import { sendError, sendSuccess } from "../utils/api-response";
import {
  validateCreateJobInput,
  validateUpdateJobStatusInput,
} from "../validators/job.validator";

export async function listJobs(_req: Request, res: Response) {
  return sendSuccess(res, await getJobs());
}

export async function getJob(req: Request, res: Response) {
  const { id } = req.params;

  if (typeof id !== "string") {
    return sendError(res, "INVALID_JOB_ID", "Invalid job id", 400);
  }

  const job = await getJobById(id);

  if (!job) {
    return sendError(res, "JOB_NOT_FOUND", "Job not found", 404);
  }

  return sendSuccess(res, job);
}

export async function createJobController(req: Request, res: Response) {
  const validation = validateCreateJobInput(req.body);

  if (!validation.success || !validation.data) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: validation.errors,
      },
    });
  }

  const job = await createJob(validation.data);

  return res.status(201).json({
    data: job,
  });
}

export async function updateJobStatusController(req: Request, res: Response) {
  const { id } = req.params;

  if (typeof id !== "string") {
    return res.status(400).json({
      error: {
        code: "INVALID_JOB_ID",
        message: "Invalid job id",
      },
    });
  }

  const validation = validateUpdateJobStatusInput(req.body);

  if (!validation.success || !validation.data) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid job data",
        details: validation.errors,
      },
    });
  }

  let job;

  try {
    job = await updateJobStatus(id, validation.data.status);
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
