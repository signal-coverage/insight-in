export const TABLE_CLASS_NAME = "w-full";

// A fixed layout takes every column's width from the column's own class: the description, which has
// none, takes whatever the others leave. Below the minimum width the table scrolls sideways instead
// of squeezing the text.
export const FIXED_TABLE_CLASS_NAME = "table-fixed min-w-[44rem]";

export const DATE_COLUMN_CLASS_NAME = "w-32";

export const AMOUNT_COLUMN_CLASS_NAME = "w-44 text-right tabular-nums";

export const RATE_COLUMN_CLASS_NAME =
  "w-36 text-right font-medium tabular-nums";

export const END_ALIGNED_CLASS_NAME = "text-right";

// A long description is cut with an ellipsis, and its full text is a tooltip.
export const DESCRIPTION_CLASS_NAME = "block max-w-sm truncate font-medium";
