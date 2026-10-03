import type { InlineAlertVariant } from "./types";

// HeroUI's Alert is a raised surface; this is a compact, flat, tinted inline message. Colour
// never carries the meaning alone: every variant keeps its own icon, and the text is semibold.
export const ROOT_CLASS_NAME =
  "items-start gap-2 rounded-lg px-3 py-2 shadow-none";

export const VARIANT_CLASS_NAMES: Record<InlineAlertVariant, string> = {
  error: "bg-danger-soft text-danger-soft-foreground",
  success: "bg-success-soft text-success-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
};

// The default indicator reserves padding for a larger icon; trim it so the icon aligns with the
// first line of text.
export const INDICATOR_CLASS_NAME = "mt-0.5 p-0 text-inherit";

export const CONTENT_CLASS_NAME = "justify-center";

// The description defaults to the muted colour; the message must read at full strength.
export const DESCRIPTION_CLASS_NAME = "font-semibold text-inherit";
