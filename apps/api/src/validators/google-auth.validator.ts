export interface GoogleAuthInput {
  idToken: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface GoogleAuthValidationResult {
  data?: GoogleAuthInput;
  errors: ValidationError[];
}

export function validateGoogleAuthInput(
  input: unknown,
): GoogleAuthValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return {
      errors: [
        {
          field: "body",
          message: "Request body must be an object",
        },
      ],
    };
  }

  const body = input as Record<string, unknown>;
  const errors: ValidationError[] = [];

  if (typeof body.idToken !== "string" || !body.idToken.trim()) {
    errors.push({
      field: "idToken",
      message: "Google ID token is required",
    });
  }

  if (errors.length > 0) {
    return { errors };
  }

  return {
    data: {
      idToken: body.idToken as string,
    },
    errors: [],
  };
}
