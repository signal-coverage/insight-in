import { formatMoney } from "@/core/incomes/money";
import type { CurrencySummary, SideSummary } from "@/core/summary/types";

import type { SideRow, SummaryRow } from "./types";

const toSideRow = (side: SideSummary, currency: string): SideRow => ({
  total: formatMoney(side.total, currency),
  settled: formatMoney(side.settled, currency),
  pending: formatMoney(side.pending, currency),
});

// Money is formatted on the server, in each row's own currency, so the client only places text.
export const toSummaryRows = (
  summary: readonly CurrencySummary[],
): SummaryRow[] =>
  summary.map(({ currency, incomes, expenses, current, target }) => ({
    currency,
    incomes: toSideRow(incomes, currency),
    expenses: toSideRow(expenses, currency),
    current: formatMoney(current, currency),
    target: formatMoney(target, currency),
  }));
