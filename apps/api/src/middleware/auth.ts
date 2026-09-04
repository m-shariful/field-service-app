import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../types/auth";

import jwt from "jsonwebtoken";
import { getUserById } from "../services/auth.service";
import { sendError } from "../utils/api-response";

interface AccessTokenPayload {
  userId: string;
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const payload = jwt.verify(token, secret) as AccessTokenPayload;

    const user = await getUserById(payload.userId);

    if (!user) {
      return sendError(res, "UNAUTHORIZED", "User no longer exists", 401);
    }

    req.user = user;

    return next();
  } catch {
    return sendError(
      res,
      "UNAUTHORIZED",
      "Invalid or expired authentication token",
      401,
    );
  }
}
