// `app-button--full-width` (see app/globals.css) lets this HeroUI Button span the row like
// a plain nav item instead of shrinking to fit its content. `app-button--static` cancels
// HeroUI's pressed look, which for a Dropdown/Popover trigger stays applied for as long as
// the menu is open, not just for the instant of the click — the category toggle has no
// such lingering state, so this trigger is made to match it: unchanged once the menu opens.
export const TRIGGER_CLASS_NAME =
  "flex w-full app-button--full-width app-button--static items-center gap-2.5 rounded-lg px-2 text-left [--button-fg:var(--foreground)] [--button-bg-hover:color-mix(in_srgb,var(--foreground)_5%,transparent)]";

export const COLLAPSED_TRIGGER_CLASS_NAME =
  "mx-auto flex items-center justify-center rounded-lg app-button--static [--button-fg:var(--foreground)] [--button-bg-hover:color-mix(in_srgb,var(--foreground)_5%,transparent)]";

export const AVATAR_CLASS_NAME = "shrink-0 bg-foreground/10";

export const AVATAR_FALLBACK_CLASS_NAME = "bg-transparent text-foreground";

export const DETAILS_CLASS_NAME = "flex min-w-0 flex-1 flex-col";

export const NAME_CLASS_NAME = "truncate text-sm leading-5 font-semibold";

export const EMAIL_CLASS_NAME = "truncate text-xs leading-4 text-muted";

export const CHEVRON_CLASS_NAME = "size-4 shrink-0 text-muted";

export const POPOVER_CLASS_NAME =
  "min-w-64 rounded-2xl bg-background text-foreground ring-1 ring-inset ring-foreground/10 shadow-[0_8px_30px_rgb(0_0_0/0.08)]";

export const MENU_CLASS_NAME = "p-2";

export const SEPARATOR_CLASS_NAME = "bg-foreground/10";
