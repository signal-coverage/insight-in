const ROOT_BASE =
  "flex h-full shrink-0 flex-col gap-3 overflow-hidden rounded-3xl bg-background shadow-[0_8px_30px_rgb(0_0_0/0.04)] ring-1 ring-inset ring-foreground/10 pb-3 px-0 text-foreground transition-[width] duration-200 ease-in-out motion-reduce:transition-none";

const ROOT_EXPANDED = "w-64";
const ROOT_COLLAPSED = "w-16";

export const getRootClassName = (isCollapsed: boolean): string =>
  `${ROOT_BASE} ${isCollapsed ? ROOT_COLLAPSED : ROOT_EXPANDED}`;
