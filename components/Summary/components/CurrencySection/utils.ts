import type { SummaryCardSpec, SummaryRow, SummaryRowSpec } from "../../types";
import { SECTION_LABEL } from "./consts";

// "Ingresos en ARS": the name of a row of cards, so a reader of the page that hears only the list
// still knows which currency and which side it is.
export const rowLabel = (title: string, currency: string): string =>
  `${title} en ${currency}`;

// "Resumen en ARS": the name of the whole section.
export const sectionLabel = (currency: string): string =>
  `${SECTION_LABEL} en ${currency}`;

// The formatted amount a card of a row shows: the incomes and the expenses have a side of their
// own, and the two remainders hang directly from the summary row.
export const valueFor = (
  summary: SummaryRow,
  row: SummaryRowSpec,
  card: SummaryCardSpec,
): string => {
  if (row.id === "incomes") return summary.incomes[toSideKey(card)];
  if (row.id === "expenses") return summary.expenses[toSideKey(card)];

  return card.id === "target" ? summary.target : summary.current;
};

const toSideKey = (card: SummaryCardSpec): "total" | "settled" | "pending" =>
  card.id === "settled" || card.id === "pending" ? card.id : "total";
