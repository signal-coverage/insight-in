import {
  LINK_SHARED_ACTIVE,
  LINK_SHARED_BASE,
  LINK_SHARED_COLLAPSED,
  LINK_SHARED_EXPANDED,
  LINK_SHARED_INACTIVE,
} from "../../styles";

// Renders as a real <button>, sharing the exact leaf-link classes (LINK_SHARED_*) so it is
// visually indistinguishable from a plain nav item — the chevron is the only addition.
// `app-button--full-width` opts this row out of the global `button { max-width: fit-content }`
// rule (see app/globals.css) so it spans the container edge to edge like sibling <a> links,
// putting the chevron flush against the right edge instead of hugging the label. Named
// `app-*` — not HeroUI's own `.button--full-width` — since it applies to a plain native
// <button>, not HeroUI's Button component.
export const getToggleClassName = (isCollapsed: boolean, isActive: boolean): string =>
  [
    LINK_SHARED_BASE,
    // `app-button--row-height` opts out of the global `button { height: 2.5rem }` default
    // so this row can shrink to match its sibling <a> links' own (smaller) height utility.
    "w-full app-button--full-width app-button--row-height",
    isCollapsed ? LINK_SHARED_COLLAPSED : LINK_SHARED_EXPANDED,
    isActive ? LINK_SHARED_ACTIVE : LINK_SHARED_INACTIVE,
  ].join(" ");

export const getChevronClassName = (isExpanded: boolean): string =>
  `size-3.5 shrink-0 text-muted transition-transform duration-200 motion-reduce:transition-none ${
    isExpanded ? "rotate-180" : ""
  }`;

// CSS grid expand/collapse trick: animating `grid-template-rows` between 0fr and 1fr
// gives a smooth height transition without measuring the content's real height in JS.
export const getChildrenWrapperClassName = (isExpanded: boolean): string =>
  `grid transition-[grid-template-rows] duration-200 ease-in-out motion-reduce:transition-none ${
    isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
  }`;

export const CHILDREN_INNER_CLASS_NAME = "overflow-hidden";

export const POPOVER_CONTENT_CLASS_NAME =
  "rounded-2xl bg-background p-2 text-foreground ring-1 ring-inset ring-foreground/10 shadow-[0_8px_30px_rgb(0_0_0/0.08)]";
