import {
  LINK_SHARED_ACTIVE,
  LINK_SHARED_BASE,
  LINK_SHARED_COLLAPSED,
  LINK_SHARED_EXPANDED,
  LINK_SHARED_INACTIVE,
} from "../../styles";

// Renders as the disclosure trigger (a real <button>), sharing the exact leaf-link classes (LINK_SHARED_*) so it is
// visually indistinguishable from a plain nav item — the chevron is the only addition.
// `app-button--full-width` opts this row out of the global `button { max-width: fit-content }`
// rule (see app/globals.css) so it spans the container edge to edge like sibling <a> links,
// putting the chevron flush against the right edge instead of hugging the label. Named
// `app-*` — not HeroUI's own `.button--full-width` — since it applies to a plain native
// <button>, not HeroUI's Button component.
export const getToggleClassName = (
  isCollapsed: boolean,
  isActive: boolean,
): string =>
  [
    LINK_SHARED_BASE,
    // `app-button--row-height` opts out of the global `button { height: 2.5rem }` default
    // so this row can shrink to match its sibling <a> links' own (smaller) height utility.
    "w-full app-button--full-width app-button--row-height",
    isCollapsed ? LINK_SHARED_COLLAPSED : LINK_SHARED_EXPANDED,
    isActive ? LINK_SHARED_ACTIVE : LINK_SHARED_INACTIVE,
  ].join(" ");

// The chevron is the disclosure indicator: it rotates by itself while the panel is open
// (`data-expanded`), so only its size and colour are set here.
export const CHEVRON_CLASS_NAME = "size-3.5 text-muted";

export const POPOVER_CONTENT_CLASS_NAME =
  "rounded-2xl bg-background p-0 text-foreground ring-1 ring-inset ring-border";
