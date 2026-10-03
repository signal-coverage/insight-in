import type { InlineAlertVariant } from "./types";

// Our variants map to HeroUI's alert statuses. Each status brings its own distinct icon.
export const STATUSES = {
  error: "danger",
  success: "success",
  warning: "warning",
} as const satisfies Record<
  InlineAlertVariant,
  "danger" | "success" | "warning"
>;
