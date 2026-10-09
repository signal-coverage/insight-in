// A fixed layout takes every column's width from the column's own class, never from what is inside
// it, so the skeleton and the real rows share the same columns. The card takes whatever the others
// leave. Below the minimum width the table scrolls sideways instead of squeezing the text.
export const FIXED_TABLE_CLASS_NAME = "table-fixed min-w-[83rem]";

// The brand logo and the title of the card, side by side.
export const CARD_CELL_CLASS_NAME = "flex min-w-0 items-center gap-2";

export const CLOSING_COLUMN_CLASS_NAME = "w-28";
export const DUE_COLUMN_CLASS_NAME = "w-36";
export const LIMIT_COLUMN_CLASS_NAME = "w-56 tabular-nums";
// The amounts, the bar and the tier chip of the usage share this column.
export const USAGE_COLUMN_CLASS_NAME = "w-80";
export const AVAILABLE_COLUMN_CLASS_NAME =
  "w-40 text-right font-medium tabular-nums";

// The bar and the chip of the skeleton, in the same two lines the usage has.
export const USAGE_SKELETON_CLASS_NAME = "flex w-full flex-col gap-2";

export const KIND_COLUMN_CLASS_NAME = "w-36";
export const BANK_COLUMN_CLASS_NAME = "w-40";

// The usage of each cap of a credit card, one under the other.
export const USAGE_LIST_CLASS_NAME = "flex w-full flex-col gap-3";
