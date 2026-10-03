import type { CardBrand } from "@/core/cards/types";

// The Remix Icon logo of each brand (the stylesheet is imported once, in the root layout). Any other
// brand has no entry and gets a generic credit card.
export const REMIX_LOGO_BY_BRAND: Readonly<Partial<Record<CardBrand, string>>> =
  {
    VISA: "ri-visa-fill",
    MASTERCARD: "ri-mastercard-fill",
  };
