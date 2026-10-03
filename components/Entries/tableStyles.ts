// Lets the bordered table box take every pixel left in the page and scroll inside itself.
// The minimum height only matters on short screens, where the page scrolls instead of
// squeezing the table to nothing.
export const TABLE_CLASS_NAME = "min-h-64 w-full flex-1";

// A fixed layout takes every column's width from the column's own class, never from what is inside
// it. That is what keeps the skeleton and the real rows on the same columns (with the automatic
// layout the columns jump when the data replaces the placeholders). The two free-text columns,
// which have no width of their own, share whatever the others leave. Below the minimum width the
// table scrolls sideways instead of squeezing the text to nothing.
export const FIXED_TABLE_CLASS_NAME = "table-fixed min-w-[48rem]";

export const END_ALIGNED_CLASS_NAME = "text-right";

export const DESCRIPTION_CLASS_NAME = "block max-w-sm truncate font-medium";

export const DESCRIPTION_ROW_CLASS_NAME = "flex items-center gap-1.5";

export const RECURRING_ICON_CLASS_NAME = "size-4 shrink-0 text-muted";

// Same footprint as the checkbox it stands in for.
export const COVERED_ICON_CLASS_NAME = "size-5 shrink-0 text-muted";

// Table cells never wrap, so a long note is cut with an ellipsis and its full text is the title.
export const NOTES_CLASS_NAME = "block max-w-xs truncate text-muted";

// The two action buttons sit side by side; the column is exactly as wide as they are, so they fill it.
export const ACTIONS_CLASS_NAME = "flex items-center justify-center gap-1";

// Column widths. The status column is as wide as its title; the actions column is its two 40px
// buttons, the 4px between them and 16px of padding on each side (116px). The checkbox column leads
// the table, so the actions column is no longer the one with the table's 16px edge inset: it asks for
// its 16px on both sides, instead of the default 8px, so the buttons sit centered (with no checkbox
// column, the edge inset gives the same 16px on the left).
export const STATUS_COLUMN_CLASS_NAME = "w-16";
export const ACTIONS_COLUMN_CLASS_NAME = "w-[7.25rem] px-4";
// A long category name is cut with an ellipsis instead of spilling into the next column.
export const CATEGORY_COLUMN_CLASS_NAME = "w-28 overflow-hidden text-ellipsis";
export const DATE_COLUMN_CLASS_NAME = "w-28";
export const AMOUNT_COLUMN_CLASS_NAME =
  "w-32 text-right font-medium tabular-nums";

export const CENTERED_CLASS_NAME = "text-center";

export const ACTION_ICON_CLASS_NAME = "size-4";

// Wraps a cell's single control (the status checkbox) so it sits in the middle of its column.
export const CENTERED_CELL_CLASS_NAME = "flex justify-center";
