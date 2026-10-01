// Which side of the budget a card belongs to; it only changes its colour.
export type MetricTone = "income" | "expense";

export interface MetricCardProps {
  // What the amount is ("Total", "Cobrado", "Actual").
  label: string;
  // The amount, already formatted for its currency.
  value?: string;
  // Shows a skeleton where the amount will be. It never shows a value or a zero: either would read
  // as a real result before the data arrives.
  isLoading?: boolean;
  // A card that has to stand out from its neighbours (the remainders of the summary).
  emphasis?: boolean;
  // Colours the card for the side it belongs to. A card with none keeps the plain look.
  tone?: MetricTone;
  // A short line under the amount that says what it means. It carries no figure, so it also shows
  // while the amount loads.
  description?: string;
}
