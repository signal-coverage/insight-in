import type { Source } from "@/components/shared/Await";
import type { BankChoice } from "@/core/banks/types";
import type {
  CardBrand,
  CardKind,
  CardLimitMode,
  CardTier,
} from "@/core/cards/types";

// One cap of a credit card, formatted on the server.
export interface CardLimitRow {
  currency: string;
  // "$ 300.000,00 por mes" or "$ 1.200.000,00 en total".
  limitLabel: string;
  // "$ 75.000,00 de $ 300.000,00": what the mode counts, against the cap.
  usedLabel: string;
  // The cap minus what was used; negative once the cap is exceeded.
  availableLabel: string;
  // The cap as plain text ("300000.00"), to prefill the form.
  limitDecimal: string;
  // 0..100: the share of the cap that was used, for the progress bar.
  percent: number;
  tier: CardTier;
}

// A card plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or presentation.
export interface CardRow {
  id: string;
  kind: CardKind;
  bankId: string;
  bankName: string;
  last4: string;
  brand: CardBrand;
  // Null for a debit card, which has no statement and no cap.
  closingDay: number | null;
  dueDay: number | null;
  limitMode: CardLimitMode | null;
  // "Visa •••• 1234".
  title: string;
  // "Visa", "Mastercard" or "Otra".
  brandName: string;
  // "Crédito" or "Débito o prepago".
  kindLabel: string;
  // "Día 25" and "Día 5"; a dash for a debit card.
  closingLabel: string;
  dueLabel: string;
  // One per cap of a credit card, in currency order; none for a debit card.
  limits: CardLimitRow[];
  // What a debit card's Tope cell says ("ARS · USD", or that its bank has no active account); null
  // for a credit card.
  currenciesLabel: string | null;
}

export interface CardsTableData {
  rows: CardRow[];
}

// The data is a `Source`: the value itself, or a promise of it while it loads. The page renders its
// structure at once and the table waits only for its own piece.
export interface CardsProps {
  table: Source<CardsTableData>;
  // The user's active banks, which the form offers for a new card.
  banks: Source<readonly BankChoice[]>;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts
// from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  card: CardRow | null;
}
