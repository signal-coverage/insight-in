// The last row of the board: one dashed card that is as wide as the board's visible area (100cqw is
// the width of the board, which is the query container) and sticks to its left edge, so it stays in
// view when the rows scroll sideways without making them any wider. The row has the same 0.75rem of
// padding as the other rows; the line above it is the one the last bank row draws.
export const ROW_CLASS_NAME = "flex";

export const FRAME_CLASS_NAME = "sticky left-0 w-[100cqw] shrink-0 p-3";

// See AccountTile/styles.ts (BankRow) for the two app-button--* classes and the radius override.
export const ADD_BANK_CLASS_NAME =
  "app-button--full-width app-button--row-height flex min-h-24 w-full items-center justify-center rounded-2xl! border border-dashed border-border p-3 text-sm text-muted hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";
