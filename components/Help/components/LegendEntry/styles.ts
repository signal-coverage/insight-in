import type { LegendTone } from "../../types";

export const ROOT_CLASS_NAME =
  "flex items-start gap-4 py-3 first:pt-0 last:pb-0";

// The square the icon (or the colour) sits in, the same size for every entry so the names line up.
export const TILE_CLASS_NAME =
  "flex size-10 shrink-0 items-center justify-center rounded-xl";

export const ICON_CLASS_NAME = "size-6";

export const SWATCH_CLASS_NAME = "size-5 rounded-full";

export const TEXT_CLASS_NAME = "flex min-w-0 flex-col gap-0.5";

export const NAME_CLASS_NAME = "font-medium";

export const DESCRIPTION_CLASS_NAME = "text-sm text-muted";

export const APPEARS_IN_CLASS_NAME = "text-xs text-muted";

// Only the app's own tokens, so every theme draws them.
export const TILE_TONE_CLASS_NAMES: Readonly<Record<LegendTone, string>> = {
  neutral: "bg-default text-default-foreground",
  positive: "bg-positive-soft text-positive-soft-foreground",
  warning: "bg-warning-soft text-warning-soft-foreground",
  danger: "bg-danger-soft text-danger-soft-foreground",
};

export const SWATCH_TONE_CLASS_NAMES: Readonly<Record<LegendTone, string>> = {
  neutral: "bg-muted",
  positive: "bg-positive",
  warning: "bg-warning",
  danger: "bg-danger",
};
