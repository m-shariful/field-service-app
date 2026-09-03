import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Internal server error",
    },
  });
};

/**
 * ** The centralized handler is for unexpected errors. **
 * MongoDB unavailable
 * Database connection failure
 * Unexpected programming error
 */
