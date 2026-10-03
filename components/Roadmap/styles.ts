export const NEW_IDEA_ICON_CLASS_NAME = "size-4";

// The board takes every pixel left in the page. It is a container, so the columns follow the width of
// the content area (which the sidebar narrows) and not the width of the window.
export const BOARD_ROOT_CLASS_NAME =
  "@container flex min-h-[28rem] min-w-0 flex-1 flex-col gap-3";

// Four columns side by side filling the area from 52rem up; below that each column keeps a readable
// width and the board scrolls sideways inside its own box, never the page. The single row is as tall
// as the board, so the columns scroll inside themselves.
export const BOARD_GRID_CLASS_NAME =
  "slim-scrollbar grid min-h-0 flex-1 grid-flow-col grid-rows-[minmax(0,1fr)] auto-cols-[18rem] gap-4 overflow-x-auto pb-2 @min-[52rem]:auto-cols-[minmax(0,1fr)]";

// One column: a quiet panel its cards sit on. The loading columns wear the same one, so nothing
// shifts when the real ones arrive.
export const COLUMN_CLASS_NAME =
  "flex min-h-0 min-w-0 flex-col gap-3 rounded-2xl bg-surface-secondary p-3 ring-1 ring-inset ring-border";
