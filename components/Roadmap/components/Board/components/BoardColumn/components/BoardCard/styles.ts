// The row React Aria drags: the card inside has its own look, so the row only carries the states of
// the drag (the card being carried is dimmed) and of the keyboard focus. The grab cursor says the card
// can be picked up.
export const ITEM_CLASS_NAME =
  "cursor-grab rounded-2xl outline-none data-[dragging]:opacity-40 data-[focus-visible]:ring-2 data-[focus-visible]:ring-focus";

// A flat card on the column's panel, tighter than HeroUI's roomy default.
export const CARD_CLASS_NAME =
  "gap-2 p-3 shadow-none ring-1 ring-inset ring-border";

// The title takes the width, and the drag handle sits at the end of the same line.
export const HEADER_CLASS_NAME = "flex items-start justify-between gap-2";

export const TITLE_CLASS_NAME = "text-sm font-medium break-words";

// Clamped to three lines: the whole text is one click away, in the edit drawer.
export const DESCRIPTION_CLASS_NAME =
  "line-clamp-3 text-sm break-words whitespace-pre-line text-muted";

export const DATE_CLASS_NAME = "text-xs text-muted";

// The buttons of the card, together at its end.
export const ACTIONS_CLASS_NAME = "justify-end gap-1";

// The drag handle is only for the keyboard and screen readers (the mouse picks up the whole card), so
// it is not drawn; it shows itself while it has the keyboard focus, so nobody tabs onto something unseen.
export const DRAG_HANDLE_CLASS_NAME = "sr-only focus-visible:not-sr-only";
