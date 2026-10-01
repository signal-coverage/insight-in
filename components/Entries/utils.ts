import type { CurrencyTotal } from "@/core/entries/types";
import { formatMoney } from "@/core/incomes/money";

import type { TotalRow } from "./types";

// Totals arrive already summed per currency by the database, over the whole filtered set.
export const toTotalRows = (totals: readonly CurrencyTotal[]): TotalRow[] =>
  totals.map(({ currency, total, settled }) => ({
    currency,
    label: formatMoney(total, currency),
    settled: formatMoney(settled, currency),
    pending: formatMoney(total - settled, currency),
  }));
