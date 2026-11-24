import { sendError, sendSuccess } from "../../utils/api-response";
import {
  InvalidNotificationCursorError,
  deactivateDeviceToken,
  getNotifications,
  getUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  registerDeviceToken,
} from "../services/notification.service";
import {
  validateDeactivateDeviceTokenInput,
  validateRegisterDeviceTokenInput,
} from "../validators/notification.validator";

import type { Response } from "express";
import type { AuthenticatedRequest } from "../../types/auth";

function getAuthenticatedUserId(req: AuthenticatedRequest): string | undefined {
  return req.user?.id;
}

export async function listNotifications(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const rawCursor = req.query.cursor;
  const rawLimit = req.query.limit;

  if (rawCursor !== undefined && typeof rawCursor !== "string") {
    return sendError(
      res,
      "INVALID_NOTIFICATION_CURSOR",
      "Invalid notification cursor",
      400,
    );
  }

  let limit: number | undefined;

  if (rawLimit !== undefined) {
    if (typeof rawLimit !== "string") {
      return sendError(
        res,
        "INVALID_NOTIFICATION_LIMIT",
        "Invalid notification limit",
        400,
      );
    }

    const parsedLimit = Number(rawLimit);

    if (
      !Number.isInteger(parsedLimit) ||
      parsedLimit < 1 ||
      parsedLimit > 100
    ) {
      return sendError(
        res,
        "INVALID_NOTIFICATION_LIMIT",
        "Notification limit must be between 1 and 100",
        400,
      );
    }

    limit = parsedLimit;
  }

  try {
    const result = await getNotifications(userId, {
      cursor: rawCursor,
      limit,
    });

    return sendSuccess(res, result);
  } catch (error) {
    if (error instanceof InvalidNotificationCursorError) {
      return sendError(
        res,
        "INVALID_NOTIFICATION_CURSOR",
        "Invalid notification cursor",
        400,
      );
    }

    throw error;
  }
}

export async function getNotificationUnreadCount(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const count = await getUnreadCount(userId);

  return sendSuccess(res, { count });
}

export async function markNotificationRead(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const { id } = req.params;

  if (typeof id !== "string" || !id.trim()) {
    return sendError(
      res,
      "INVALID_NOTIFICATION_ID",
      "Invalid notification id",
      400,
    );
  }

  const notification = await markNotificationAsRead(id, userId);

  if (!notification) {
    return sendError(
      res,
      "NOTIFICATION_NOT_FOUND",
      "Notification not found",
      404,
    );
  }

  return sendSuccess(res, notification);
}

export async function markAllNotificationsRead(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const modifiedCount = await markAllNotificationsAsRead(userId);

  return sendSuccess(res, { modifiedCount });
}

export async function registerNotificationDevice(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const validation = validateRegisterDeviceTokenInput(req.body);

  if (!validation.success || !validation.data) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid device registration data",
      400,
      validation.errors,
    );
  }

  const device = await registerDeviceToken(userId, validation.data);

  return sendSuccess(res, device);
}

export async function deactivateNotificationDevice(
  req: AuthenticatedRequest,
  res: Response,
) {
  const userId = getAuthenticatedUserId(req);

  if (!userId) {
    return sendError(res, "UNAUTHORIZED", "Authentication required", 401);
  }

  const validation = validateDeactivateDeviceTokenInput(req.body);

  if (!validation.success || !validation.data) {
    return sendError(
      res,
      "VALIDATION_ERROR",
      "Invalid device deactivation data",
      400,
      validation.errors,
    );
  }

  const deactivated = await deactivateDeviceToken(
    userId,
    validation.data.token,
  );

  if (!deactivated) {
    return sendError(
      res,
      "DEVICE_TOKEN_NOT_FOUND",
      "Active device token not found",
      404,
    );
  }

  return sendSuccess(res, { deactivated: true });
}
