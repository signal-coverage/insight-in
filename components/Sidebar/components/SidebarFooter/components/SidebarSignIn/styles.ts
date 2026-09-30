const BUTTON_BASE_CLASS_NAME =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent text-sm font-semibold text-accent-foreground transition-all hover:brightness-110 active:scale-[0.98]";

export const TRIGGER_CLASS_NAME = `${BUTTON_BASE_CLASS_NAME} w-full app-button--full-width px-4`;

// `button--icon-only` is normally applied by HeroUI's `Button isIconOnly` — added by hand
// here so this native <button> is exempt from the global `button { min-width: 6rem }` rule
// (see app/globals.css) the same way HeroUI's icon buttons are.
export const COLLAPSED_TRIGGER_CLASS_NAME = `${BUTTON_BASE_CLASS_NAME} button--icon-only mx-auto size-10`;

export const ICON_CLASS_NAME = "size-4 shrink-0";
