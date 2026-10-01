export const EDGE_COLUMN_PADDING_CLASSNAME =
  "[&_th:first-child]:pl-4 [&_th:last-child]:pr-4 [&_td:first-child]:pl-4 [&_td:last-child]:pr-4";

// `bg-surface` gives the box a solid fill so the edge fades (`from-surface`) blend into it.
export const WRAPPER_CLASSNAME =
  "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface";

// The area the table scrolls inside, loading or loaded.
export const SCROLL_AREA_CLASSNAME = "min-h-0 min-w-0 flex-1 overflow-auto";

// Holds the scroll area and the edge fades laid over it.
export const SCROLL_BOX_CLASSNAME =
  "relative flex min-h-0 min-w-0 flex-1 flex-col";

export const FOOTER_CLASSNAME = "border-t border-border";

export const ROW_INTERACTIVE_CLASSNAME =
  "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-focus/50 focus-visible:ring-inset";
