import { COLUMN_FRAME_CLASS_NAME } from "@/components/Banks/styles";

// The first column of a row. It stays in view while the account cards scroll under it, so its fill
// is opaque (never an opacity on this box), and its right edge is the only vertical line of the
// board. Its width is shared with the loading skeleton (COLUMN_FRAME_CLASS_NAME in the styles
// of Banks); the padding is the only thing it adds, and leaves a 6.5rem card on a phone.
export const COLUMN_CLASS_NAME = `${COLUMN_FRAME_CLASS_NAME} p-3`;

// The bank as a card inside the column, its name (and the archived chip under it) centered. See AccountTile/styles.ts for the two app-button--* classes
// and for why the radius is overridden with `!`.
export const CELL_CLASS_NAME =
  "app-button--full-width app-button--row-height flex min-h-24 min-w-0 flex-1 flex-col items-center justify-center gap-2 rounded-2xl! bg-surface-secondary p-3 text-center ring-1 ring-inset ring-border hover:bg-surface-tertiary focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none";

export const NAME_CLASS_NAME =
  "line-clamp-2 text-base font-semibold break-words";

// The column is sticky over the scrolling cards, so its box stays opaque: only the name is dimmed.
export const ARCHIVED_NAME_CLASS_NAME = `${NAME_CLASS_NAME} opacity-60`;

// The chips under the name (a wallet, archived), side by side and wrapping on a narrow card.
export const CHIPS_CLASS_NAME = "flex flex-wrap justify-center gap-1";
