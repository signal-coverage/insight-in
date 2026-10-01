import type { InlineAlertVariant } from "./types";

// Colour never carries the meaning alone: every variant has its own icon, and the text is
// semibold in the foreground colour inside a tinted container.
export const ROOT_CLASS_NAME =
  "flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-foreground";

export const ICON_CLASS_NAME = "mt-0.5 size-4 shrink-0";

export const VARIANT_CLASS_NAMES: Record<InlineAlertVariant, string> = {
  error: "bg-danger-soft text-danger-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
};
