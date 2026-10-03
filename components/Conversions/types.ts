import type { ComponentType, SVGProps } from "react";

import type { Source } from "@/components/shared/Await";
import type { ConversionSide } from "@/core/conversions/types";

// Everything the page shows is already text, formatted on the server in each amount's own currency,
// so the client only places it.

export interface RateView {
  // "$ 1.240,00": net currency units for one origin unit.
  rate: string;
  // "5 sept 2026".
  date: string;
}

export interface ItemView {
  id: string;
  date: string;
  description: string;
  origin: string;
  net: string;
  rate: string;
}

export interface PairView {
  // "USDC → ARS".
  id: string;
  side: ConversionSide;
  originCurrency: string;
  count: string;
  totalOrigin: string;
  totalNet: string;
  averageRate: string;
  best: RateView;
  worst: RateView;
  last: RateView;
  items: ItemView[];
}

export interface EvolutionRowView {
  // "Septiembre de 2026".
  month: string;
  rate: string;
  // "+10,0 %", or a dash when the month before has no data.
  variation: string;
}

export interface EvolutionView {
  id: string;
  side: ConversionSide;
  // "USDC → ARS".
  pair: string;
  rows: EvolutionRowView[];
}

export interface ConversionsView {
  incomes: PairView[];
  expenses: PairView[];
  evolution: EvolutionView[];
}

export interface ConversionsProps {
  // The month the numbers belong to, "YYYY-MM", and the month in course, which is where the
  // selector's "Mes actual" goes.
  month: string;
  currentMonth: string;
  // The month written out ("Septiembre de 2026").
  monthLabel: string;
  // The conversions, or a promise of them while they load.
  conversions: Source<ConversionsView>;
}

// The words and the look of one side of the page, described once so the real block, its loading
// placeholder and its tables always agree.
export interface SideCopy {
  title: string;
  description: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  // Colours the title and the cards for the side they belong to.
  tone: "income" | "expense";
  // The number of conversions.
  countLabel: string;
  // What was sent (an income) or what the price said (an expense), in the origin currency.
  originLabel: string;
  // What arrived (an income) or what was paid (an expense), in the net currency.
  netLabel: string;
}

export type PairCardId =
  "count" | "origin" | "net" | "average" | "best" | "worst" | "last";

export interface PairCard {
  id: PairCardId;
  label: string;
  value: string;
  description?: string;
}
