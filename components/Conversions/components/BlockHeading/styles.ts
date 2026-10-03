export const ROOT_CLASS_NAME = "flex flex-col gap-1";

export const TITLE_CLASS_NAME =
  "inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm font-semibold";

// The title wears the colour of its cards: incomes the cool one, expenses the warm one, and the
// evolution the accent, which is the strongest in both modes.
export const TONE_CLASS_NAMES = {
  income: "bg-success-soft text-success-soft-foreground",
  expense: "bg-warning-soft text-warning-soft-foreground",
  balance: "bg-accent text-accent-foreground",
} as const;

export const ICON_CLASS_NAME = "size-4 shrink-0";

export const DESCRIPTION_CLASS_NAME = "text-sm text-muted";
