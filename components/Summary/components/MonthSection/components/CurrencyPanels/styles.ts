export const ROOT_CLASS_NAME = "flex flex-col gap-4";

// The tabs and the currency picker on one row; the tabs take the width the picker leaves and give
// way first on a narrow screen.
export const TOOLBAR_CLASS_NAME =
  "flex flex-wrap items-center justify-between gap-3";

// Same corner as the picker button beside it (rounded-xl); the tab and its indicator sit inside, so
// they take the next size down.
export const LIST_CONTAINER_CLASS_NAME = "min-w-0 flex-1 rounded-xl";

export const LIST_CLASS_NAME = "w-full";

export const TAB_CLASS_NAME = "flex-1 rounded-lg";

export const INDICATOR_CLASS_NAME = "rounded-lg";

export const PANEL_CLASS_NAME = "flex flex-col gap-6 pt-3 px-0";

// Roughly the height of the three charts (the 6-month one on top, the other two below), so the page
// does not jump when they arrive.
export const CHARTS_SKELETON_CLASS_NAME = "h-[40rem] w-full rounded-2xl";
