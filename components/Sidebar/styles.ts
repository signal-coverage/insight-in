// Split in two: the toggle button is a sibling of the card (not a child), positioned to
// straddle the card's edge — it needs `overflow: visible` here so that isn't clipped,
// while the card itself keeps `overflow-hidden` for its own rounded corners.
const OUTER_BASE =
  "relative h-full shrink-0 transition-[width] duration-200 ease-in-out motion-reduce:transition-none";

const ROOT_EXPANDED = "w-64";
const ROOT_COLLAPSED = "w-16";

export const getRootClassName = (isCollapsed: boolean): string =>
  `${OUTER_BASE} ${isCollapsed ? ROOT_COLLAPSED : ROOT_EXPANDED}`;

export const CARD_CLASS_NAME =
  "flex h-full flex-col gap-3 overflow-hidden rounded-b-2xl bg-background shadow-[0_8px_30px_rgb(0_0_0/0.04)] ring-1 ring-inset ring-foreground/10 pb-3 px-0 text-foreground";
