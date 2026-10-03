// The list item only sizes the card inside a row of totals; the look lives on the HeroUI card.
export const ITEM_CLASS_NAME = "flex min-w-44";

// HeroUI's card is a raised surface with roomy padding; a metric is a flat, tight figure.
export const ROOT_CLASS_NAME =
  "w-full gap-1 rounded-2xl px-4 py-3 shadow-none ring-1 ring-inset ring-border";

// The tones use the theme's own colours, so they follow the palette in both modes: incomes take the
// cool one (`success`), expenses the warm one (`warning`).
export const TONE_CLASS_NAMES = {
  income: "bg-success-soft ring-success",
  expense: "bg-warning-soft ring-warning",
} as const;

// The ring thickens and takes the accent colour, so the card reads as the result of the others.
export const EMPHASIS_CLASS_NAME = "ring-2 ring-accent";

export const HEADER_CLASS_NAME = "gap-1";

export const LABEL_CLASS_NAME = "text-xs leading-4 text-muted";

export const CONTENT_CLASS_NAME = "gap-1";

export const VALUE_CLASS_NAME = "text-lg font-semibold tabular-nums";

export const EMPHASIS_VALUE_CLASS_NAME = "text-2xl";

export const DESCRIPTION_CLASS_NAME = "text-xs leading-4 text-foreground/70";

// Roughly the height of the amount line, so a card does not jump when it arrives.
export const SKELETON_CLASS_NAME = "h-7 w-28 rounded-md";
