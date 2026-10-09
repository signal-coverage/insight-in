export const LIST_CLASS_NAME = "flex flex-col gap-2";

// Name, bar and amount on one line; the name gives way first.
export const ROW_CLASS_NAME =
  "relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1 rounded-md text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";

export const NAME_CLASS_NAME = "truncate";

export const TRACK_CLASS_NAME =
  "col-span-2 row-start-2 block h-2.5 rounded-full bg-surface-secondary";

// Expenses keep their warm colour; "Otras" is muted so it never reads as one more category.
export const BAR_CLASS_NAME =
  "block h-2.5 rounded-full bg-warning-soft-foreground";

export const OTHER_BAR_CLASS_NAME = "block h-2.5 rounded-full bg-muted";

export const AMOUNT_CLASS_NAME = "tabular-nums";

export const TOOLTIP_CLASS_NAME =
  "pointer-events-none absolute -top-8 right-0 z-10 rounded-lg bg-surface px-2 py-1 text-xs shadow-md ring-1 ring-border";
