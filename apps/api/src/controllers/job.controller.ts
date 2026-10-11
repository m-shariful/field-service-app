import {
  IdempotencyInProgressError,
  IdempotencyKeyReuseError,
  executeIdempotently,
} from "../services/idempotency.service";
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

import type { AuthenticatedRequest } from "../types/auth";
import type { Response } from "express";

function getAuthenticatedUserId(req: AuthenticatedRequest): string | undefined {
  return req.user?.id;
}

function getIdempotencyKey(req: AuthenticatedRequest): string | undefined {
  const value = req.header("Idempotency-Key");

  return value?.trim() || undefined;
}

function handleIdempotencyError(
  res: Response,
  error: unknown,
): Response | null {
  if (error instanceof IdempotencyKeyReuseError) {
    return sendError(
      res,
      "IDEMPOTENCY_KEY_REUSED",
      "The same idempotency key was used with different request data",
      409,
    );
  }

  if (error instanceof IdempotencyInProgressError) {
    return sendError(
      res,
      "IDEMPOTENCY_REQUEST_IN_PROGRESS",
      "The same mutation is currently being processed",
      409,
    );
  }

  return null;
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

  try {
    const result = await executeIdempotently({
      userId,
      key: getIdempotencyKey(req),
      scope: "jobs:create",
      requestPayload: validation.data,

      execute: async () => {
        const job = await createJob(userId, validation.data!);

        return {
          statusCode: 201,
          body: {
            data: job,
          },
        };
      },
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    const idempotencyResponse = handleIdempotencyError(res, error);

    if (idempotencyResponse) {
      return idempotencyResponse;
    }

    if (error instanceof Error && error.message === "JOB_ID_ALREADY_EXISTS") {
      return sendError(
        res,
        "JOB_ID_ALREADY_EXISTS",
        "The supplied job id is already in use",
        409,
      );
    }

    throw error;
  }
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

  try {
    const result = await executeIdempotently({
      userId,
      key: getIdempotencyKey(req),
      scope: `jobs:update-status:${id}`,
      requestPayload: validation.data,

      execute: async () => {
        let job: Awaited<ReturnType<typeof updateJobStatus>>;

        try {
          job = await updateJobStatus(id, userId, validation.data!.status);
        } catch (error) {
          return {
            statusCode: 400,
            body: {
              error: {
                code: "INVALID_STATUS_TRANSITION",
                message:
                  error instanceof Error
                    ? error.message
                    : "Invalid job status transition",
              },
            },
          };
        }

        if (!job) {
          return {
            statusCode: 404,
            body: {
              error: {
                code: "JOB_NOT_FOUND",
                message: "Job not found",
              },
            },
          };
        }

        return {
          statusCode: 200,
          body: {
            data: job,
          },
        };
      },
    });

    return res.status(result.statusCode).json(result.body);
  } catch (error) {
    const idempotencyResponse = handleIdempotencyError(res, error);

    if (idempotencyResponse) {
      return idempotencyResponse;
    }

    throw error;
  }
}
