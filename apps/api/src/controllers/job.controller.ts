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

import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";

function getAuthenticatedUserId(req: AuthenticatedRequest): string | undefined {
  return req.user?.id;
}

export async function listJobs(req: AuthenticatedRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  return sendSuccess(res, await getJobs(userId));
}

export async function getJob(req: AuthenticatedRequest, res: Response) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = req.params;

  if (typeof id !== "string") {
    return sendError(res, "INVALID_JOB_ID", "Invalid job id", 400);
  }

  const job = await getJobById(id, userId);

  if (!job) {
    return sendError(res, "JOB_NOT_FOUND", "Job not found", 404);
  }

  return sendSuccess(res, job);
}

export async function createJobController(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const validation = validateCreateJobInput(req.body);

  if (!validation.success || !validation.data) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid job data",
      400,
      validation.errors,
    );
  }

  const job = await createJob(userId, validation.data);

  return sendSuccess(res, job, 201);
}

export async function updateJobStatusController(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = req.params;

  if (typeof id !== "string") {
    return sendError(res, "INVALID_JOB_ID", "Invalid job id", 400);
  }

  const validation = validateUpdateJobStatusInput(req.body);

  if (!validation.success || !validation.data) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid job data",
      400,
      validation.errors,
    );
  }

  let job;

  try {
    job = await updateJobStatus(id, userId, validation.data.status);
  } catch (error) {
    return sendError(
      res,
      "INVALID_STATUS_TRANSITION",
      error instanceof Error ? error.message : "Invalid job status transition",
      400,
    );
  }

  if (!job) {
    return sendError(res, "JOB_NOT_FOUND", "Job not found", 404);
  }

  return sendSuccess(res, job);
}
