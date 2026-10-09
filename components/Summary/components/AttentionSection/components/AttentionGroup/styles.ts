export const ROOT_CLASS_NAME = "flex flex-col gap-1.5";

export const HEADER_CLASS_NAME = "flex items-baseline justify-between gap-3";

export const TITLE_CLASS_NAME = "text-sm font-semibold";

export const LINK_CLASS_NAME = "shrink-0 text-sm";

export const LIST_CLASS_NAME = "flex flex-col gap-1";

export const ROW_CLASS_NAME =
  "flex items-baseline justify-between gap-3 text-sm";

// The name gives way first; the date follows it, smaller: beside it on a wide screen, under it on a phone.
export const TEXT_CLASS_NAME =
  "flex min-w-0 flex-col sm:flex-row sm:items-baseline sm:gap-2";

export const NAME_CLASS_NAME = "truncate";

export const DATE_CLASS_NAME = "shrink-0 text-xs text-muted";

export const AMOUNT_CLASS_NAME = "shrink-0 font-medium tabular-nums";

// Overdue, negative or over the cap: red, never blocked.
export const DANGER_AMOUNT_CLASS_NAME = `${AMOUNT_CLASS_NAME} text-danger`;

export const MORE_CLASS_NAME = "text-xs text-muted";
