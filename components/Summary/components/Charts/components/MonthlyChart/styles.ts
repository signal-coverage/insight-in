export const WRAPPER_CLASS_NAME = "relative";

export const SVG_CLASS_NAME = "h-auto w-full overflow-visible";

// The tooltip sits in a top corner, on the side away from the month it describes.
export const TOOLTIP_CLASS_NAME =
  "pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-lg bg-surface px-3 py-2 text-xs shadow-md ring-1 ring-border";

export const TOOLTIP_RIGHT_CLASS_NAME = "right-0";

export const TOOLTIP_LEFT_CLASS_NAME = "left-0";

export const TOOLTIP_TITLE_CLASS_NAME = "font-semibold";

export const BASELINE_CLASS_NAME = "stroke-border";

// The month under the pointer or the focus gets a faint band, so it is clear which one the tooltip is about.
export const GROUP_CLASS_NAME =
  "outline-none [&:focus-visible>rect:first-child]:fill-surface-secondary [&:focus-visible>rect:first-child]:stroke-accent [&:focus-visible>rect:first-child]:[stroke-width:2] [&:hover>rect:first-child]:fill-surface-secondary";

export const HIT_CLASS_NAME = "fill-transparent";

// Incomes the cool colour, expenses the warm one, as in the cards above the charts.
export const INCOME_BAR_CLASS_NAME = "fill-success";

export const EXPENSE_BAR_CLASS_NAME = "fill-warning";

export const AXIS_TEXT_CLASS_NAME = "fill-muted text-[11px]";

export const INCOME_SWATCH_CLASS_NAME = "bg-success";

export const EXPENSE_SWATCH_CLASS_NAME = "bg-warning";
