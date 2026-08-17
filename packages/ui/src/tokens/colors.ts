/**
 * Raw color palette shared across web/mobile. Tailwind (web) consumes these via
 * theme.css; a future React Native app would import this file directly.
 */
export const palette = {
  indigo: {
    50: "#EEF1FF",
    100: "#E0E4FF",
    200: "#C6CCFF",
    300: "#A5AEFF",
    400: "#818CFA",
    500: "#5B5FEF",
    600: "#4640D6",
    700: "#3730A8",
    800: "#2D2A80",
    900: "#211F5C",
  },
  marigold: {
    400: "#F0B75E",
    500: "#E8A33D",
    600: "#CC7A1F",
  },
  teal: {
    400: "#2BB3A3",
    500: "#0F9B8E",
    600: "#0B7A70",
  },
  gray: {
    0: "#FFFFFF",
    50: "#F7F8FA",
    100: "#EEF0F3",
    200: "#E2E5EA",
    300: "#C9CDD6",
    400: "#9AA1AE",
    500: "#6B7280",
    600: "#4B5160",
    700: "#343A46",
    800: "#20232B",
    900: "#14161B",
    950: "#0D0F13",
  },
  semantic: {
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    info: "#2563EB",
  },
} as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  "2xl": "32px",
  "3xl": "48px",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
  lg: "16px",
  xl: "24px",
  full: "9999px",
} as const;

export const duration = {
  fast: "120ms",
  base: "180ms",
  slow: "260ms",
  transition: "320ms",
} as const;
