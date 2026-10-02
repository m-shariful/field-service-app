import type { RequestHandler, Response } from "express";
import {
  loginUser,
  loginWithGoogle,
  logoutUser,
  refreshSession,
  registerUser,
} from "../services/auth.service";
import { sendError, sendSuccess } from "../utils/api-response";
import {
  validateLoginInput,
  validateRegisterInput,
} from "../validators/auth.validator";

import type { AuthenticatedRequest } from "../types/auth";
import { validateGoogleAuthInput } from "../validators/google-auth.validator";
import { validateRefreshTokenInput } from "../validators/refresh-token.validator";

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

export const googleAuthController: RequestHandler = async (req, res) => {
  const validation = validateGoogleAuthInput(req.body);

  if (validation.errors.length > 0 || !validation.data) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: validation.errors,
      },
    });

    return;
  }

  try {
    const result = await loginWithGoogle(validation.data.idToken);

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INVALID_GOOGLE_TOKEN") {
      res.status(401).json({
        error: {
          code: "INVALID_GOOGLE_TOKEN",
          message: "Invalid Google authentication token",
        },
      });

      return;
    }

    if (error instanceof Error && error.message === "GOOGLE_EMAIL_MISSING") {
      res.status(401).json({
        error: {
          code: "GOOGLE_EMAIL_MISSING",
          message: "Google account email is unavailable",
        },
      });

      return;
    }

    if (
      error instanceof Error &&
      error.message === "GOOGLE_EMAIL_NOT_VERIFIED"
    ) {
      res.status(401).json({
        error: {
          code: "GOOGLE_EMAIL_NOT_VERIFIED",
          message: "Google account email is not verified",
        },
      });

      return;
    }

    if (error instanceof Error && error.message === "ACCOUNT_LINK_REQUIRED") {
      res.status(409).json({
        error: {
          code: "ACCOUNT_LINK_REQUIRED",
          message:
            "An account with this email already exists. Sign in with your existing account and link Google from account settings.",
        },
      });

      return;
    }

    if (error instanceof Error && error.message === "AUTH_IDENTITY_ORPHANED") {
      console.error("Google auth identity is orphaned:", error);

      res.status(500).json({
        error: {
          code: "INTERNAL_SERVER_ERROR",
          message: "Authentication identity is not linked correctly",
        },
      });

      return;
    }

    console.error("Google authentication failed:", error);

    res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
      },
    });
  }
};

export const refreshController: RequestHandler = async (req, res) => {
  const validation = validateRefreshTokenInput(req.body);

  if (!validation.success || !validation.data) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid refresh token data",
        details: validation.errors,
      },
    });

    return;
  }

  try {
    const result = await refreshSession(validation.data.refreshToken);

    res.status(200).json({
      data: result,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "REFRESH_TOKEN_REUSED") {
      console.warn("Refresh-token reuse caused session-family revocation.");
    }

    if (
      error instanceof Error &&
      (error.message === "INVALID_REFRESH_TOKEN" ||
        error.message === "REFRESH_TOKEN_REUSED")
    ) {
      res.status(401).json({
        error: {
          code: "INVALID_REFRESH_TOKEN",
          message: "Session is no longer valid. Please sign in again.",
        },
      });

      return;
    }

    throw error;
  }
};

export const logoutController: RequestHandler = async (req, res) => {
  const validation = validateRefreshTokenInput(req.body);

  if (!validation.success || !validation.data) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid logout data",
        details: validation.errors,
      },
    });

    return;
  }

  await logoutUser(validation.data.refreshToken);

  sendSuccess(res, {
    success: true,
  });
};

export function meController(req: AuthenticatedRequest, res: Response) {
  return sendSuccess(res, req.user);
}
