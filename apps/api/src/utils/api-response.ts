import type { ApiErrorResponse, ApiSuccessResponse } from "../types/api";

import type { Response } from "express";

/**
 * Centralizing the HTTP response formatting.
 * So that it prevents different controllers from slowly inventing different response formats.
 */

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): Response<ApiSuccessResponse<T>> {
  return res.status(statusCode).json({
    data,
  });
}

export function sendError(
  res: Response,
  code: string,
  message: string,
  statusCode: number,
  details?: Record<string, string>,
): Response<ApiErrorResponse> {
  return res.status(statusCode).json({
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  });
}
