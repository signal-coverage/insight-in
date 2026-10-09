// A raw <button> is hit by the global button rule of app/globals.css (fixed height, fit-content
// width, padding, field radius): the two app-button--* classes are its documented opt-outs. That
// rule is unlayered, so it beats the radius utilities: `rounded-2xl!` is the only way to round the
// card. The card is tinted and has its own inset ring; it stretches to the row (6rem at least).
export const TILE_CLASS_NAME =
  "app-button--full-width app-button--row-height flex min-h-24 w-44 shrink-0 flex-col items-start justify-between gap-1 rounded-2xl! bg-surface-secondary p-3 text-left ring-1 ring-inset ring-border hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";

// An archived account stays readable but quieter.
export const ARCHIVED_TILE_CLASS_NAME = `${TILE_CLASS_NAME} opacity-60`;

// Each row of the card has a fixed line height and never shrinks (`shrink-0`), so the column cannot
// squeeze one of them. A long name is cut sideways with an ellipsis (`truncate`), never vertically.
export const NAME_CLASS_NAME =
  "max-w-full shrink-0 truncate text-sm leading-5 font-medium";

// The balance under the name; a negative one is red (it is shown, never blocked).
export const BALANCE_CLASS_NAME =
  "shrink-0 text-sm leading-5 font-medium tabular-nums";
export const NEGATIVE_BALANCE_CLASS_NAME = `${BALANCE_CLASS_NAME} text-danger`;

// The bottom row of the card: the archived chip (only when archived) on the left, the currency on
// the right (its own `ml-auto`, so it stays on the right when it is alone).
export const META_CLASS_NAME =
  "flex w-full shrink-0 items-center justify-between gap-1";

export const CURRENCY_CLASS_NAME = "ml-auto";
