import { loginUser, registerUser } from "../services/auth.service";
import { sendError, sendSuccess } from "../utils/api-response";
import {
  validateLoginInput,
  validateRegisterInput,
} from "../validators/auth.validator";

import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";

export async function registerController(
  req: AuthenticatedRequest,
  res: Response,
) {
  const validation = validateRegisterInput(req.body);

  if (!validation.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid registration data",
      400,
      validation.errors,
    );
  }

  try {
    const result = await registerUser(validation.data);

    return sendSuccess(res, result, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "EMAIL_ALREADY_EXISTS") {
      return sendError(
        res,
        "EMAIL_ALREADY_EXISTS",
        "An account with this email already exists",
        409,
      );
    }

    throw error;
  }
}

export async function loginController(
  req: AuthenticatedRequest,
  res: Response,
) {
  const validation = validateLoginInput(req.body);

  if (!validation.success) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid login data",
      400,
      validation.errors,
    );
  }

  try {
    const result = await loginUser(validation.data);

    return sendSuccess(res, result);
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_CREDENTIALS") {
      return sendError(
        res,
        "INVALID_CREDENTIALS",
        "Invalid email or password",
        401,
      );
    }

    throw error;
  }
}

export function meController(req: AuthenticatedRequest, res: Response) {
  return sendSuccess(res, req.user);
}
