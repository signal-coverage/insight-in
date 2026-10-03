import { BRAND_NAMES, CARD_BRANDS } from "@/core/cards/consts";

import type { BrandOption } from "./types";

export const BRAND_LABEL = "Marca";

// The field name the form submits the brand under.
export const BRAND_FIELD_NAME = "brand";

// In the order the radios appear. The brand is only illustrative: it does not change how the card
// is billed.
export const BRAND_OPTIONS: readonly BrandOption[] = CARD_BRANDS.map(
  (value) => ({ value, label: BRAND_NAMES[value] }),
);
