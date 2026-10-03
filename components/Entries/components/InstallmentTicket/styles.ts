import type { CSSProperties } from "react";

// A receipt drawn with CSS only, from the theme's own tokens so it reads in all of them: the
// surface colour for the paper, the border colour for the dashes, the muted text for the labels.
export const WRAPPER_CLASS_NAME = "flex flex-col drop-shadow-sm";

export const PAPER_CLASS_NAME =
  "flex flex-col gap-3 border-x border-t-2 border-dashed border-border bg-surface px-5 pt-4 font-mono text-sm tabular-nums text-foreground";

export const BRAND_CLASS_NAME =
  "text-center text-xs font-semibold tracking-[0.3em] text-muted";

export const HEADING_CLASS_NAME = "text-center text-base font-semibold";

// HeroUI's Separator draws its line as a background; the dashed border is the ticket's own look, so
// the background is cleared and the line becomes a dashed top border.
export const SEPARATOR_CLASS_NAME =
  "h-0 border-t border-dashed border-border bg-transparent";

export const LINES_CLASS_NAME =
  "flex flex-col gap-2 border-b-2 border-dashed border-border pb-4";

export const LINE_CLASS_NAME = "flex items-baseline justify-between gap-4";

export const LABEL_CLASS_NAME = "text-muted";

export const VALUE_CLASS_NAME = "text-right font-medium";

export const NOTE_CLASS_NAME = "mt-1 text-right text-xs text-muted";

// The torn edge: a strip of paper whose lower half is cut into teeth with a mask, so the ticket
// ends in a zig-zag. Each 14px tile keeps a downward-pointing triangle.
export const EDGE_CLASS_NAME = "h-2 bg-surface";

export const EDGE_STYLE: CSSProperties = {
  WebkitMaskImage:
    "conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)",
  maskImage:
    "conic-gradient(from -45deg at bottom, #0000, #000 1deg 89deg, #0000 90deg)",
  WebkitMaskSize: "14px 100%",
  maskSize: "14px 100%",
  WebkitMaskPosition: "50%",
  maskPosition: "50%",
};
