// The app shell: the sidebar and the page side by side on a slightly tinted background.
export const SHELL_CLASS_NAME =
  "flex h-full flex-row gap-3 bg-[color-mix(in_oklab,var(--background),var(--foreground)_5%)] p-4 pt-0 text-foreground";

// Everything right of the sidebar: the navbar on top and the page below, which scrolls on its own.
export const MAIN_COLUMN_CLASS_NAME = "flex min-h-0 min-w-0 flex-1 flex-col";

export const PAGE_AREA_CLASS_NAME =
  "flex min-h-0 flex-1 flex-col overflow-y-auto";
