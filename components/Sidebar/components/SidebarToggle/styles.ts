// `app-button--chip` (see app/globals.css) opts this button out of the global button
// sizing defaults (height/min-width/border-radius) — this one is a small floating circle,
// not a standard-sized control, and needs to be free to be its own size and fully round.
// Absolutely positioned against the outer <aside> (not the inner rounded/clipped card, see
// Sidebar/styles.ts) so it can poke past the card's right edge without being clipped by the
// card's own `overflow-hidden`. `top-5` centers it on the 64px header row (same height as
// the logo and the navbar's breadcrumb) — not on the header's bottom border.
export const BUTTON_CLASS_NAME =
  "app-button--chip absolute -right-3 top-5 z-10 flex size-6 items-center justify-center rounded-full bg-background text-foreground ring-1 ring-inset ring-border hover:bg-default";

export const getIconClassName = (isCollapsed: boolean): string =>
  `size-3.5 transition-transform duration-200 motion-reduce:transition-none ${
    isCollapsed ? "" : "rotate-180"
  }`;
