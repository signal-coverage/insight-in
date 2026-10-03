import type { BrandLogoSize } from "./types";

// A light badge, so the logo reads the same on every theme background.
export const BADGE_CLASS_NAMES: Readonly<Record<BrandLogoSize, string>> = {
  sm: "inline-flex h-6 w-9 shrink-0 items-center justify-center rounded bg-white shadow-sm ring-1 ring-black/10",
  lg: "inline-flex h-11 w-16 shrink-0 items-center justify-center rounded-md bg-white shadow-sm ring-1 ring-black/10",
};

// Remix Icon logos are font glyphs, sized with the font size (about 24px in the table, 40px in the
// preview) and painted with the text colour: a dark neutral stays legible on the white badge.
export const REMIX_LOGO_CLASS_NAMES: Readonly<Record<BrandLogoSize, string>> = {
  sm: "text-2xl leading-none text-neutral-800",
  lg: "text-[40px] leading-none text-neutral-800",
};

export const FALLBACK_ICON_CLASS_NAMES: Readonly<
  Record<BrandLogoSize, string>
> = {
  sm: "size-3.5 text-neutral-600",
  lg: "size-6 text-neutral-600",
};
