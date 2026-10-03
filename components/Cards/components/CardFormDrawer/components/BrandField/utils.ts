import { CARD_BRANDS } from "@/core/cards/consts";
import type { CardBrand } from "@/core/cards/types";

// The brand a radio value stands for, or undefined for anything that is not one.
export const toBrand = (value: string): CardBrand | undefined =>
  CARD_BRANDS.find((brand) => brand === value);
