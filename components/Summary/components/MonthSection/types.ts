import type { ReactNode } from "react";

import type { Source } from "@/components/shared/Await";

import type {
  BlockResult,
  CurrencyChartsRow,
  SummaryRow,
  SummaryView,
} from "../../types";

export interface MonthSectionProps {
  // Which block it is: the month in detail (figures), or the last six months (charts).
  view: SummaryView;
  // "YYYY-MM": the month shown and the month in course.
  month: string;
  currentMonth: string;
  // "Septiembre de 2026".
  monthLabel: string;
  // One row per currency tab, or a promise of them while they load.
  summary: Source<readonly SummaryRow[]>;
  // The currencies the user hides from the tabs (display only), or a promise of them while they load.
  hiddenCurrencies: Source<readonly string[]>;
  charts: Source<BlockResult<readonly CurrencyChartsRow[]>>;
  // Beside the heading ("Saldo inicial"): nothing is rendered there when it is not given.
  aside?: ReactNode;
  // Under the heading, above the tabs (the expected incomes switch).
  controls?: ReactNode;
}
