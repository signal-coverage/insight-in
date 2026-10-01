import type { ComponentType, SVGProps } from "react";

import type { Source } from "@/components/shared/Await";

// One side of the budget (incomes or expenses), every amount already formatted for its currency so
// the client never re-derives money presentation.
export interface SideRow {
  total: string;
  settled: string;
  pending: string;
}

export interface SummaryRow {
  currency: string;
  incomes: SideRow;
  expenses: SideRow;
  // What is in hand right now.
  current: string;
  // Where the month would end if nothing else changed.
  target: string;
}

export interface SummaryProps {
  // The month the numbers belong to, "YYYY-MM", and the month in course, which is where the
  // selector's "Mes actual" goes.
  month: string;
  currentMonth: string;
  // The month the numbers belong to, written out ("Septiembre de 2026").
  monthLabel: string;
  // One row per currency, or a promise of them while they load.
  summary: Source<readonly SummaryRow[]>;
}

// What a row of cards is about: money coming in, money going out, or what is left.
export type RowTone = "income" | "expense" | "balance";

export interface SummaryCardSpec {
  // Which amount of the summary row the card shows.
  id: "total" | "settled" | "pending" | "current" | "target";
  label: string;
  // A line that says what the amount means, for the ones that are not obvious.
  description?: string;
}

// A row of a currency's section, described once so the real section and its loading placeholder
// are always made of the same rows.
export interface SummaryRowSpec {
  id: "incomes" | "expenses" | "remainders";
  title: string;
  tone: RowTone;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  // The remainders are the result of the other rows, so their cards stand out.
  emphasis: boolean;
  cards: readonly SummaryCardSpec[];
}
