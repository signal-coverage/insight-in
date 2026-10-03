import type { CardTier } from "@/core/cards/types";

export const ROOT_CLASS_NAME = "flex w-full flex-col gap-1.5";

export const USED_CLASS_NAME =
  "block truncate text-sm font-medium tabular-nums";

// The bar and the chip share a line; the bar takes whatever the chip leaves.
export const FOOTER_CLASS_NAME = "flex items-center gap-3";

export const BAR_CLASS_NAME = "min-w-0 flex-1";

// The fill of the bar follows the tier, with the same tokens as the chip: green, warm and red.
export const BAR_TIER_CLASS_NAMES: Readonly<Record<CardTier, string>> = {
  available: "[--progress-bar-fill:var(--positive)]",
  near: "[--progress-bar-fill:var(--warning)]",
  exceeded: "[--progress-bar-fill:var(--danger)]",
};
