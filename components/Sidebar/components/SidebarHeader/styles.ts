import { TOP_BAR_CLASS_NAME } from "@/components/shared/consts";

export const LOGO_MARK_CLASS_NAME =
  "flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-base font-semibold text-accent-foreground";

export const BRAND_CLASS_NAME = "flex min-w-0 items-center gap-2";

const ROOT_BASE = `flex items-center ${TOP_BAR_CLASS_NAME}`;
const ROOT_EXPANDED = "px-4";
const ROOT_COLLAPSED = "justify-center px-0";

const WORDMARK_VISIBLE = "truncate text-base font-semibold";

export const getRootClassName = (isCollapsed: boolean): string =>
  `${ROOT_BASE} ${isCollapsed ? ROOT_COLLAPSED : ROOT_EXPANDED}`;

export const getWordmarkClassName = (isCollapsed: boolean): string =>
  isCollapsed ? "sr-only" : WORDMARK_VISIBLE;
