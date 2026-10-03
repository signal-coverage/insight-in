import type { Source } from "@/components/shared/Await";
import type { CardWithUsage } from "@/core/cards/types";

// A card plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or presentation.
export interface CardRow extends CardWithUsage {
  // "Visa •••• 1234".
  title: string;
  // "Visa", "Mastercard" or "Otra".
  brandName: string;
  // "Día 25" and "Día 5".
  closingLabel: string;
  dueLabel: string;
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
}

export interface CardsTableData {
  rows: CardRow[];
}

// The data is a `Source`: the value itself, or a promise of it while it loads. The page renders its
// structure at once and the table waits only for its own piece.
export interface CardsProps {
  table: Source<CardsTableData>;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts
// from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  card: CardRow | null;
}
