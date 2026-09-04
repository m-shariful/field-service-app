export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export function validateRegisterInput(
  input: unknown,
):
  | { success: true; data: RegisterInput }
  | { success: false; errors: Record<string, string> } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: {
        body: "Request body must be an object",
      },
    };
  }

  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  if (typeof body.name !== "string" || !body.name.trim()) {
    errors.name = "Name is required";
  } else if (body.name.trim().length > 100) {
    errors.name = "Name must not exceed 100 characters";
  }

  if (typeof body.email !== "string" || !body.email.trim()) {
    errors.email = "Email is required";
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    errors.email = "Email must be valid";
  }

  if (typeof body.password !== "string" || !body.password) {
    errors.password = "Password is required";
  } else if (body.password.length < 8) {
    errors.password = "Password must be at least 8 characters";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      name: body.name as string,
      email: (body.email as string).toLowerCase().trim(),
      password: body.password as string,
    },
  };
}

export function validateLoginInput(
  input: unknown,
):
  | { success: true; data: LoginInput }
  | { success: false; errors: Record<string, string> } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      success: false,
      errors: {
        body: "Request body must be an object",
      },
    };
  }

  const body = input as Record<string, unknown>;
  const errors: Record<string, string> = {};

  if (typeof body.email !== "string" || !body.email.trim()) {
    errors.email = "Email is required";
  }

  if (typeof body.password !== "string" || !body.password) {
    errors.password = "Password is required";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    data: {
      email: (body.email as string).toLowerCase().trim(),
      password: body.password as string,
    },
  };
}
