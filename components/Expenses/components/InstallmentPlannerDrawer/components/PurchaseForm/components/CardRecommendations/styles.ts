import type { CardVerdict } from "@/core/cards/types";

export const ROOT_CLASS_NAME = "flex flex-col gap-2";

export const HEADING_CLASS_NAME = "text-sm font-medium";

export const LIST_CLASS_NAME = "flex flex-col gap-2";

export const ITEM_CLASS_NAME =
  "flex flex-wrap items-center justify-between gap-2 rounded-lg bg-default px-3 py-2";

export const TITLE_CLASS_NAME = "text-sm font-medium tabular-nums";

export const ICON_CLASS_NAME = "size-4 shrink-0";

export const EMPTY_CLASS_NAME = "px-1 text-sm text-muted";

// The verdict is a HeroUI Chip; these classes give it the soft colours of its tier. Green comes from
// the `positive` tokens every theme defines; the warm and the red ones are the warning and danger.
export const VERDICT_CLASS_NAMES: Readonly<Record<CardVerdict, string>> = {
  fits: "gap-1 bg-positive-soft text-positive-soft-foreground",
  near: "gap-1 bg-warning-soft text-warning-soft-foreground",
  exceeded: "gap-1 bg-danger-soft text-danger-soft-foreground",
};
