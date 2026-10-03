import type { CardBrand } from "@/core/cards/types";

export interface BrandFieldProps {
  // The brand selected: Visa for a new card, the stored one on edit. The form owns it, so the card
  // preview can follow it.
  value: CardBrand;
  onChange: (brand: CardBrand) => void;
}

export interface BrandOption {
  value: CardBrand;
  label: string;
}
