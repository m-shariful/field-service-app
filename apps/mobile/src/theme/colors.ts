export const colors = {
  background: "#F7F8FA",
  surface: "#FFFFFF",

  text: {
    primary: "#111827",
    secondary: "#6B7280",
    muted: "#9CA3AF",
    inverse: "#FFFFFF",
  },

  border: "#E5E7EB",

  primary: "#2563EB",

  skeleton: "#E2E8F0",

  status: {
    scheduled: {
      background: "#EFF6FF",
      text: "#2563EB",
    },
    in_progress: {
      background: "#FFF7ED",
      text: "#EA580C",
    },
    completed: {
      background: "#ECFDF5",
      text: "#059669",
    },
  },

  priority: {
    low: "#6B7280",
    normal: "#2563EB",
    high: "#D97706",
    urgent: "#DC2626",
  },
} as const;
