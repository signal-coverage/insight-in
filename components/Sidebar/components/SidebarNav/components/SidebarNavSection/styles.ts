const TITLE_CLASS_NAME =
  "block px-2 pb-2 text-xs font-semibold tracking-wide text-muted uppercase";

const HIDDEN_TITLE_CLASS_NAME = "sr-only";

export const LIST_CLASS_NAME = "flex flex-col gap-1";

// Collapsed, the title has no room: it stays in the page for screen readers only.
export const getTitleClassName = (isCollapsed: boolean): string =>
  isCollapsed ? HIDDEN_TITLE_CLASS_NAME : TITLE_CLASS_NAME;
