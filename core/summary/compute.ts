import { foldCurrencyTotals } from "@/core/entries/listing";
import type { CurrencyTotal } from "@/core/entries/types";

import type {
  CurrencySummary,
  SideSummary,
  StatusGroup,
  SummarizeOptions,
} from "./types";
import { EMPTY_SIDE } from "./consts";

const toSide = ({ total, settled }: CurrencyTotal): SideSummary => ({
  total,
  settled,
  pending: total - settled,
});

// Puts a month's incomes and expenses side by side, per currency (they are never added across
// currencies). A currency that appears on only one side still gets a row, with zero on the other.
export const summarize = (
  incomeGroups: readonly StatusGroup[],
  expenseGroups: readonly StatusGroup[],
  { includeExpectedIncomes = true }: SummarizeOptions = {},
): CurrencySummary[] => {
  const incomes = new Map(
    foldCurrencyTotals(incomeGroups).map((row) => [row.currency, toSide(row)]),
  );
  const expenses = new Map(
    foldCurrencyTotals(expenseGroups).map((row) => [row.currency, toSide(row)]),
  );
  const currencies = [...new Set([...incomes.keys(), ...expenses.keys()])].sort(
    (a, b) => a.localeCompare(b),
  );

  return currencies.map((currency) => {
    const incomeSide = incomes.get(currency) ?? EMPTY_SIDE;
    const expenseSide = expenses.get(currency) ?? EMPTY_SIDE;
    const current = incomeSide.settled - expenseSide.settled;
    const expectedIncomes = includeExpectedIncomes ? incomeSide.pending : 0;

    return {
      currency,
      incomes: incomeSide,
      expenses: expenseSide,
      current,
      target: current + expectedIncomes - expenseSide.pending,
    };
  });
};
