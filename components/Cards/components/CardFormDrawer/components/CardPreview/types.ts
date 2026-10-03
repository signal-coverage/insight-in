import type { CardBrand } from "@/core/cards/types";

export interface CardPreviewProps {
  brand: CardBrand;
  // The digits typed so far, none to four.
  last4: string;
  // The days typed so far; NaN while a field is empty.
  closingDay: number;
  dueDay: number;
}
