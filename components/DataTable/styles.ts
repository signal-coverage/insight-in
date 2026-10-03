// These classes sit on top of HeroUI's `secondary` Table (no fill, no padding and no rounding on
// the root), so the app keeps its own look: HeroUI's component layer loses to every utility below.

export const EDGE_COLUMN_PADDING_CLASSNAME =
  "[&_th:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4";

// `bg-surface` gives the box a solid fill so the edge fades (`from-surface`) blend into it. The
// root is a column (not HeroUI's grid) so the scrolling area takes the height the box is given.
export const WRAPPER_CLASSNAME =
  "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface";

// The area the table scrolls inside, loading or loaded (HeroUI's container only scrolls sideways).
export const SCROLL_AREA_CLASSNAME = "min-h-0 min-w-0 flex-1 overflow-auto";

// Holds the scroll area and the edge fades laid over it.
export const SCROLL_BOX_CLASSNAME =
  "relative flex min-h-0 min-w-0 flex-1 flex-col";

// HeroUI pads the footer and lays it out as a flex row; the footer content brings its own padding.
export const FOOTER_CLASSNAME = "block border-t border-border p-0";

// Header cell: 40px tall, 8px of padding, the divider under it and none of HeroUI's rounded
// "standalone header" corners or column separators.
export const COLUMN_CLASSNAME =
  "h-10 rounded-none border-b border-border px-2 py-0 text-left align-middle text-sm font-medium whitespace-nowrap text-foreground after:hidden";

// Body cell: 8px of padding all round, never wrapping. Hover and fill come from HeroUI.
export const CELL_CLASSNAME =
  "rounded-none border-border p-2 align-middle text-sm whitespace-nowrap";

export const ROW_SELECTED_CLASSNAME = "data-[state=selected]:[&>td]:bg-default";

// The last row has no divider: the box (or the footer) already draws one.
export const BODY_CLASSNAME = "[&_tr:last-child_td]:border-b-0";

// A note under a row can be long. Zero intrinsic width keeps it from widening the table (the
// columns decide the width), and `min-w-full` still gives it the whole cell to wrap inside.
export const ROW_NOTE_CLASSNAME = "w-0 min-w-full whitespace-normal";

export const ROW_INTERACTIVE_CLASSNAME = "cursor-pointer";

// The checkbox column: the table's 16px edge inset, the 20px checkbox and 8px of padding (44px). It
// is the same on the header, on every cell and on the skeleton, so the columns never move.
export const SELECTION_COLUMN_CLASSNAME = "w-11";

export const SELECTION_SKELETON_CLASSNAME = "size-5 rounded-md";

// A row on its way out: dimmed (HeroUI also dims a disabled row, this keeps it so without it).
export const ROW_BUSY_CLASSNAME = "opacity-50";

// The announcement of a busy table: read out, never drawn.
export const BUSY_STATUS_CLASSNAME = "sr-only";

// A note says something about the row above it, so it never dims with the row-level disabling the
// selection puts on it (a note is not something to select).
export const NOTE_ROW_CLASSNAME = "opacity-100";
