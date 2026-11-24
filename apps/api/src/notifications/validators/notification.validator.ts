import type { DevicePlatform } from "../models/device-token";

interface ValidationResult<T> {
  success: boolean;
  errors: Record<string, string>;
  data?: T;
}

export interface RegisterDeviceTokenData {
  token: string;
  platform: DevicePlatform;
  deviceId?: string | null;
}

export interface DeactivateDeviceTokenData {
  token: string;
}

export function validateRegisterDeviceTokenInput(
  input: unknown,
): ValidationResult<RegisterDeviceTokenData> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: { body: "Request body must be an object" },
    };
  }

  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  if (
    typeof body.token !== "string" ||
    !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(body.token.trim())
  ) {
    errors.token = "A valid Expo push token is required";
  }

  if (body.platform !== "ios" && body.platform !== "android") {
    errors.platform = "Platform must be ios or android";
  }

  if (body.deviceId !== undefined && body.deviceId !== null) {
    if (typeof body.deviceId !== "string" || !body.deviceId.trim()) {
      errors.deviceId = "Device id must be a non-empty string";
    } else if (body.deviceId.trim().length > 150) {
      errors.deviceId = "Device id must be 150 characters or fewer";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, errors };
  }

  return {
    success: true,
    errors: {},
    data: {
      token: (body.token as string).trim(),
      platform: body.platform as DevicePlatform,
      deviceId: typeof body.deviceId === "string" ? body.deviceId.trim() : null,
    },
  };
}

export function validateDeactivateDeviceTokenInput(
  input: unknown,
): ValidationResult<DeactivateDeviceTokenData> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: { body: "Request body must be an object" },
    };
  }

  const body = input as Record<string, unknown>;

  if (
    typeof body.token !== "string" ||
    !/^Expo(nent)?PushToken\[[^\]]+\]$/.test(body.token.trim())
  ) {
    return {
      success: false,
      errors: { token: "A valid Expo push token is required" },
    };
  }

  return {
    success: true,
    errors: {},
    data: {
      token: body.token.trim(),
    },
  };
}
