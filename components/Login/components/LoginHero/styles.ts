// Flat palette shapes (no gradients, glows or blur): the accent as the ground in light mode
// (a quiet surface in dark, where the accent is a light grey), with the success and warning
// tints as geometry on top.
export const ROOT_CLASS_NAME =
  "relative hidden flex-1 overflow-hidden rounded-2xl bg-accent lg:block dark:bg-surface";

export const CLOUD_CLASS_NAME =
  "absolute -top-10 right-0 size-96 rounded-full bg-success/70";

export const HILL_CLASS_NAME =
  "absolute -bottom-24 -left-16 size-[28rem] rounded-full bg-warning/70";

export const GRID_CLASS_NAME =
  "absolute inset-0 opacity-20 [background-image:linear-gradient(to_right,var(--accent-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--accent-foreground)_1px,transparent_1px)] [background-size:6px_6px]";
