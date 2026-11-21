export const QUEUE_NAMES = {
  NOTIFICATIONS: "notifications",
} as const;

export const NOTIFICATION_JOB_NAMES = {
  DELIVER: "notification.deliver",
} as const;

export const NOTIFICATION_QUEUE_DEFAULT_OPTIONS = {
  attempts: 5,
  backoff: {
    type: "exponential" as const,
    delay: 5_000,
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 1_000,
  },
  removeOnFail: {
    age: 7 * 24 * 60 * 60,
  },
} as const;
