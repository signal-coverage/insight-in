import type { CardBrand } from "@/core/cards/types";

import type { FormTarget } from "../../types";

export interface CardFormDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  target: FormTarget;
}

// What the form holds while it is open, shared by the fields and the card preview.
export interface CardDraft {
  last4: string;
  brand: CardBrand;
  // NaN while a day field is empty.
  closingDay: number;
  dueDay: number;
  setLast4: (last4: string) => void;
  setBrand: (brand: CardBrand) => void;
  setClosingDay: (day: number) => void;
  setDueDay: (day: number) => void;
}

export type CardFormContentProps = Pick<
  CardFormDrawerProps,
  "onClose" | "target"
>;
