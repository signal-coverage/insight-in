const LINK_BASE =
  "flex h-9 items-center rounded-lg text-xs font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

const LINK_EXPANDED = "gap-2 px-1.5";
const LINK_COLLAPSED = "justify-center";

// The app switches themes via `prefers-color-scheme` (see globals.css), which HeroUI's
// `dark:` variant does not follow, so the media query is used directly.
const LINK_ACTIVE =
  "bg-foreground text-background shadow-md [@media(prefers-color-scheme:dark)]:bg-foreground/15 [@media(prefers-color-scheme:dark)]:text-foreground [@media(prefers-color-scheme:dark)]:shadow-none";
const LINK_INACTIVE = "text-muted hover:bg-foreground/5 hover:text-foreground";

export const ICON_CLASS_NAME = "size-4 shrink-0";

export const getLinkClassName = (isCollapsed: boolean, isActive: boolean): string =>
  [
    LINK_BASE,
    isCollapsed ? LINK_COLLAPSED : LINK_EXPANDED,
    isActive ? LINK_ACTIVE : LINK_INACTIVE,
  ].join(" ");

// `flex-1 min-w-0` makes the label absorb the row's leftover space — on a leaf link that's
// invisible (nothing sits after it), but on the category toggle it's what pushes the
// chevron flush to the right edge without pulling the label away from its icon the way
// `justify-between` on the row would.
export const getLabelClassName = (isCollapsed: boolean): string =>
  isCollapsed ? "sr-only" : "min-w-0 flex-1 truncate text-left";

// Re-exported so SidebarNavItemGroup's expandable row matches leaf links exactly.
export const LINK_SHARED_BASE = LINK_BASE;
export const LINK_SHARED_EXPANDED = LINK_EXPANDED;
export const LINK_SHARED_COLLAPSED = LINK_COLLAPSED;
export const LINK_SHARED_ACTIVE = LINK_ACTIVE;
export const LINK_SHARED_INACTIVE = LINK_INACTIVE;
