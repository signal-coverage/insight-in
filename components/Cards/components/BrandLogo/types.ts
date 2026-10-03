import type { CardBrand } from "@/core/cards/types";

export type BrandLogoSize = "sm" | "lg";

export interface BrandLogoProps {
  brand: CardBrand;
  // "sm" is the logo of the table; "lg" is the one of the card preview.
  size?: BrandLogoSize;
}
