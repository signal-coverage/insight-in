// The board looks like the data tables of Ingresos and Gastos (same border, radius and fill) and is
// also the box it scrolls inside, in both directions, so the page never scrolls. Like those tables it
// takes the height the page column leaves under the header and the toolbar (`flex-1`, with the same
// `min-h-64` floor as the Entries tables); `content-start` keeps the rows at the top at their own
// height, and the free space under the last row is just container background. Its rounded corners
// clip the content. It is a query container (`@container`) so the "+ Nuevo banco" row can be as wide
// as the visible board (100cqw) and stay in view when the rows scroll sideways, without widening them. The single grid column is as wide as the widest row (or the box, if that is
// wider), so every row, and the line under it, spans the whole scroll width. The rows are told apart
// only by the divider between them.
// The scroll padding is the sticky bank column (9rem on a phone, 13rem from sm up, padding and
// border included) plus the 0.75rem of padding before the first card: 9.75rem and 13.75rem. A card
// that takes focus scrolls clear of the bank column instead of ending up under it.
export const BOARD_CLASS_NAME =
  "@container slim-scrollbar grid min-h-64 min-w-0 flex-1 scroll-pl-39 grid-cols-[minmax(max-content,1fr)] content-start divide-y divide-border overflow-auto rounded-2xl border border-border bg-surface sm:scroll-pl-55";

// One row: the bank column first, then the account cards. The cards stretch to the row, which is at
// least 7.5rem tall (a 6rem card and 0.75rem of padding above and below) and grows with a bank card
// that needs more room.
export const ROW_CLASS_NAME = "flex min-h-30 items-stretch";

// Said when there is nothing to show, in the same quiet voice as the hints of the forms.
export const EMPTY_CLASS_NAME = "px-1 text-sm text-muted";

// The sticky bank column, shared by the real column and its loading skeleton so they cannot drift:
// 9rem wide on a phone and 13rem from sm up (padding and line included), opaque so the account cards
// scroll under it, with the board's one vertical line on its right edge, which ends at the last
// bank row. The scroll padding above is this width plus 0.75rem.
export const COLUMN_FRAME_CLASS_NAME =
  "sticky left-0 z-10 flex w-36 shrink-0 border-r border-border bg-surface sm:w-52";
