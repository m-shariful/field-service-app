export interface RefreshTokenInput {
  refreshToken: string;
}

interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
  data?: RefreshTokenInput;
}

export function validateRefreshTokenInput(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: {
        body: "Request body must be an object",
      },
    };
  }

  const body = input as Record<string, unknown>;

  if (typeof body.refreshToken !== "string" || !body.refreshToken.trim()) {
    return {
      success: false,
      errors: {
        refreshToken: "Refresh token is required",
      },
    };
  }

  return {
    success: true,
    errors: {},
    data: {
      refreshToken: body.refreshToken,
    },
  };
}
