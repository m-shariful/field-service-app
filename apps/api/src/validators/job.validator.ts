import type { JobPriority, JobStatus } from "../models/job";

const JOB_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

interface CreateJobInput {
  title: string;
  scheduledAt: string;
  location: string;
  priority: JobPriority;
}

interface ValidationResult {
  success: boolean;
  errors: Record<string, string>;
  data?: CreateJobInput;
}

export function validateCreateJobInput(input: unknown): ValidationResult {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== "object") {
    return {
      success: false,
      errors: {
        body: "Request body must be an object",
      },
    };
  }

  const body = input as Record<string, unknown>;

  // Learning: Validate at the HTTP boundary before data reaches
  // the service/database layer.
  if (typeof body.title !== "string" || !body.title.trim()) {
    errors.title = "Title is required";
  } else if (body.title.trim().length > 200) {
    errors.title = "Title must be 200 characters or fewer";
  }

  if (typeof body.location !== "string" || !body.location.trim()) {
    errors.location = "Location is required";
  } else if (body.location.trim().length > 300) {
    errors.location = "Location must be 300 characters or fewer";
  }

  if (typeof body.scheduledAt !== "string" || !body.scheduledAt.trim()) {
    errors.scheduledAt = "Scheduled date and time is required";
  } else if (Number.isNaN(Date.parse(body.scheduledAt))) {
    errors.scheduledAt = "Scheduled date and time must be valid";
  }

  if (
    typeof body.priority !== "string" ||
    !JOB_PRIORITIES.includes(body.priority as JobPriority)
  ) {
    errors.priority = "Priority must be low, normal, high, or urgent";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    errors: {},
    data: {
      title: (body.title as string).trim(),
      scheduledAt: body.scheduledAt as string,
      location: (body.location as string).trim(),
      priority: body.priority as JobPriority,
    },
  };
}

const JOB_STATUSES = ["scheduled", "in_progress", "completed"] as const;

interface UpdateJobStatusInput {
  status: JobStatus;
}

export function validateUpdateJobStatusInput(input: unknown): {
  success: boolean;
  errors: Record<string, string>;
  data?: UpdateJobStatusInput;
} {
  const errors: Record<string, string> = {};

  if (!input || typeof input !== "object") {
    return {
      success: false,
      errors: {
        body: "Request body must be an object",
      },
    };
  }

  const body = input as Record<string, unknown>;

  // Learning: Validate the status value separately from
  // business-rule validation such as allowed transitions.
  if (
    typeof body.status !== "string" ||
    !JOB_STATUSES.includes(body.status as JobStatus)
  ) {
    errors.status = "Status must be scheduled, in_progress, or completed";
  }

  if (Object.keys(errors).length > 0) {
    return {
      success: false,
      errors,
    };
  }

  return {
    success: true,
    errors: {},
    data: {
      status: body.status as JobStatus,
    },
  };
}
