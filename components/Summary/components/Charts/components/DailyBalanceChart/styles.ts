export const WRAPPER_CLASS_NAME = "relative flex flex-col gap-2";

export const SVG_CLASS_NAME =
  "h-auto w-full overflow-visible rounded-md outline-none focus-visible:ring-2 focus-visible:ring-accent";

// Always mounted, so a screen reader hears the first day announced; the tooltip appears inside it.
export const LIVE_REGION_CLASS_NAME = "pointer-events-none absolute top-0 z-10";

// On the side away from the active day, so the tooltip never covers it.
export const LIVE_RIGHT_CLASS_NAME = "right-0";

export const LIVE_LEFT_CLASS_NAME = "left-0";

export const TOOLTIP_CLASS_NAME =
  "rounded-lg bg-surface px-3 py-2 text-xs shadow-md ring-1 ring-border";

// A thin line in the accent colour; the zero line recessive and dashed.
export const LINE_CLASS_NAME = "fill-none stroke-accent [stroke-width:2]";

export const ZERO_LINE_CLASS_NAME = "stroke-border [stroke-dasharray:4_4]";

export const HIT_CLASS_NAME = "fill-transparent";

export const CROSSHAIR_CLASS_NAME = "stroke-border";

export const DOT_CLASS_NAME = "fill-accent";

export const NEGATIVE_DOT_CLASS_NAME = "fill-danger";

export const CAPTION_CLASS_NAME =
  "flex flex-wrap justify-between gap-2 text-xs text-muted";

export const LAST_CLASS_NAME = "font-medium text-foreground tabular-nums";

export const NEGATIVE_LAST_CLASS_NAME = "font-medium text-danger tabular-nums";
