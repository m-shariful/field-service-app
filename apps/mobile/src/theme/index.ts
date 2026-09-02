export const colors = {
  background: "#F8FAFC",
  surface: "#FFFFFF",
  border: "#E2E8F0",

  text: {
    primary: "#0F172A",
    secondary: "#475569",
    muted: "#64748B",
    inverse: "#FFFFFF",
  },

  primary: {
    50: "#EFF6FF",
    500: "#3B82F6",
    600: "#2563EB",
    700: "#1D4ED8",
  },

  success: {
    50: "#ECFDF5",
    500: "#10B981",
    700: "#047857",
  },

  warning: {
    50: "#FFF7ED",
    500: "#F97316",
    700: "#C2410C",
  },

  danger: {
    50: "#FEF2F2",
    500: "#EF4444",
    700: "#DC2626",
  },

  neutral: {
    50: "#F8FAFC",
    100: "#F1F5F9",
    200: "#E2E8F0",
    500: "#64748B",
    700: "#334155",
    900: "#0F172A",
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  display: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "700" as const,
  },

  heading: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700" as const,
  },

  title: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600" as const,
  },

  body: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "400" as const,
  },

  bodyMedium: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500" as const,
  },

  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400" as const,
  },

  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600" as const,
  },
} as const;
