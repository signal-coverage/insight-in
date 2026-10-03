import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";
import { formatMoney } from "@/core/incomes/money";

export const TOTAL_LABEL_PREFIX = "Total";

// With nothing to add up the page keeps the same shape: the cards at zero in the default
// currency, instead of the row disappearing.
const ZERO = formatMoney(0, DEFAULT_CURRENCY_CODE);

export const EMPTY_TOTALS = [
  {
    currency: DEFAULT_CURRENCY_CODE,
    label: ZERO,
    settled: ZERO,
    pending: ZERO,
  },
];
