const LINK_BASE =
  "flex h-11 items-center rounded-xl text-sm font-medium whitespace-nowrap outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none";

const LINK_EXPANDED = "gap-3 px-2.5";
const LINK_COLLAPSED = "justify-center";

// The app switches themes via `prefers-color-scheme` (see globals.css), which HeroUI's
// `dark:` variant does not follow, so the media query is used directly.
const LINK_ACTIVE =
  "bg-foreground text-background shadow-md [@media(prefers-color-scheme:dark)]:bg-foreground/15 [@media(prefers-color-scheme:dark)]:text-foreground [@media(prefers-color-scheme:dark)]:shadow-none";
const LINK_INACTIVE = "text-muted hover:bg-foreground/5 hover:text-foreground";

export const ICON_CLASS_NAME = "size-5 shrink-0";

export const getLinkClassName = (isCollapsed: boolean, isActive: boolean): string =>
  [
    LINK_BASE,
    isCollapsed ? LINK_COLLAPSED : LINK_EXPANDED,
    isActive ? LINK_ACTIVE : LINK_INACTIVE,
  ].join(" ");

export const getLabelClassName = (isCollapsed: boolean): string =>
  isCollapsed ? "sr-only" : "truncate";
