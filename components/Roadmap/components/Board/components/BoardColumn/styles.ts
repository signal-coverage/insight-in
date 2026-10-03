export const HEADER_CLASS_NAME = "flex items-center gap-2";

export const TITLE_CLASS_NAME = "min-w-0 flex-1 truncate text-sm font-semibold";

export const ADD_ICON_CLASS_NAME = "size-4";

// The cards of the column, which scroll inside it. The whole list is the drop target of an empty
// column, and it tints while a card hovers over it.
export const LIST_CLASS_NAME =
  "slim-scrollbar flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto rounded-xl pr-1 outline-none data-[drop-target]:bg-accent-soft";

// The line that shows where a dragged card will land. It takes no room of its own (the negative
// margins cancel the gaps around it) and draws its line only while it is the target.
export const DROP_INDICATOR_CLASS_NAME =
  "relative -my-1 h-0 data-[drop-target]:after:absolute data-[drop-target]:after:inset-x-0 data-[drop-target]:after:-top-0.5 data-[drop-target]:after:h-1 data-[drop-target]:after:rounded-full data-[drop-target]:after:bg-accent data-[drop-target]:after:content-['']";
