import type { SidebarNavChildListVariant } from "./types";

// Solid (fully opaque) equivalent of `foreground/20` against the sidebar's own background —
// deliberately NOT a translucent `/20` utility. The trunk and each item's branch overlap by
// design where the branch's own vertical stroke runs alongside the trunk segment, and two
// translucent layers stacked on top of each other blend into a visibly darker/thicker patch
// exactly where they overlap. Two solid layers of the identical color don't.
//
// Both already include their variant prefix baked in as literal text — Tailwind's scanner
// only ever reads raw source text (it never runs this file's JS), so a class name assembled
// at runtime via `` `before:${SOME_CONST}` `` is invisible to it: the literal characters
// "before:${SOME_CONST}" appear in the file, never the resulting string, so no CSS rule ever
// gets generated for it. Same reason a bare `SOME_CONST` spliced into a list of otherwise
// prefixed classes doesn't work either — it applies to the real element instead of the
// pseudo-element. Keep these as complete literal strings, one per prefix that needs them.
const TREE_LINE_BEFORE_BORDER =
  "before:border-[color-mix(in_srgb,var(--foreground)_20%,var(--background))]";
const TREE_LINE_AFTER_BG =
  "after:bg-[color-mix(in_srgb,var(--foreground)_20%,var(--background))]";

const LIST_BASE = "flex flex-col py-1";
const LIST_TREE = "ml-6 pr-0";
const LIST_FLYOUT = "ml-0 min-w-40 pr-0";

export const getListClassName = (variant: SidebarNavChildListVariant): string =>
  `${LIST_BASE} ${variant === "tree" ? LIST_TREE : LIST_FLYOUT}`;

/**
 * There is no single continuous trunk anymore. Each <li> draws its OWN trunk segment
 * (the `after` pseudo-element) alongside its own branch (the `before`):
 *
 *   ├ normal: branch, trunk both above AND below (passes through, connecting both ways —
 *   │         including the first item, which still connects upward to the group toggle)
 *   └ last:   branch, trunk only ABOVE it (nothing below — nothing to connect to there)
 *
 * h-7 rows are 28px, center at 14px. The branch box (`h-3` = 12px) has its elbow — the
 * `rounded-bl-md` corner where `border-b` meets `border-l` — on its own BOTTOM edge, not
 * its center, so that edge (not the box) has to land on 14px for the branch to meet the
 * text at mid-height. `top-0.5` (2px) + `h-3` (12px) puts it there. The trunk segment
 * splits at that same 14px mark so it always picks up exactly where the branch's elbow
 * is, with no gap and no overlap.
 */
export const getItemClassName = (isLast: boolean): string => {
  const trunk = isLast
    ? ["after:top-0", "after:bottom-3.5"] // above the elbow only
    : ["after:top-0", "after:bottom-0"]; // passes through

  return [
    "relative",

    // Branch
    "before:absolute",
    "before:left-3",
    "before:top-0.5",
    "before:h-3",
    "before:w-3",
    "before:rounded-bl-md",
    "before:border-b",
    "before:border-l",
    TREE_LINE_BEFORE_BORDER,
    "before:content-['']",

    // Trunk segment
    ...(trunk.length > 0
      ? [
          "after:absolute",
          "after:left-3",
          "after:w-px",
          ...trunk,
          TREE_LINE_AFTER_BG,
          "after:content-['']",
        ]
      : []),
  ].join(" ");
};

const LINK_BASE = [
  // Keeps the link away from the trunk and branch
  "ml-6",

  "flex",
  "h-7",
  "items-center",
  "truncate",
  "rounded-lg",
  "px-2",

  "text-xs",
  "outline-none",
  "transition-colors",
  "focus-visible:ring-2",
  "focus-visible:ring-focus",
  "motion-reduce:transition-none",
].join(" ");

const LINK_ACTIVE = "bg-default font-semibold text-foreground";

const LINK_INACTIVE = "text-muted hover:text-foreground";

export const getChildLinkClassName = (isActive: boolean): string =>
  `${LINK_BASE} ${isActive ? LINK_ACTIVE : LINK_INACTIVE}`;

export const getDisabledChildClassName = (): string =>
  `${LINK_BASE} cursor-default text-muted/50`;
