import { compareCurrencyCodes } from "@/core/currencies/crypto";
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
// The remainders count every account of the currency: the previous balance, plus what was collected,
// minus what was paid; the target adds what is still pending.
export const summarize = (
  incomeGroups: readonly StatusGroup[],
  expenseGroups: readonly StatusGroup[],
  {
    includeExpectedIncomes = true,
    previous = [],
    reimbursements = [],
  }: SummarizeOptions = {},
): CurrencySummary[] => {
  const incomes = new Map(
    foldCurrencyTotals(incomeGroups).map((row) => [row.currency, toSide(row)]),
  );
  const expenses = new Map(
    foldCurrencyTotals(expenseGroups).map((row) => [row.currency, toSide(row)]),
  );
  const previousByCurrency = new Map(
    previous.map((row) => [row.currency, row]),
  );
  const pendingByCurrency = new Map(
    reimbursements.map(({ currency, amount }) => [currency, amount]),
  );
  const currencies = [
    ...new Set([
      ...incomes.keys(),
      ...expenses.keys(),
      ...previousByCurrency.keys(),
      ...pendingByCurrency.keys(),
    ]),
  ].sort(compareCurrencyCodes);

  return currencies.map((currency) => {
    const incomeSide = incomes.get(currency) ?? EMPTY_SIDE;
    const expenseSide = expenses.get(currency) ?? EMPTY_SIDE;
    const before = previousByCurrency.get(currency)?.amount ?? 0;
    const current = before + incomeSide.settled - expenseSide.settled;
    const expectedIncomes = includeExpectedIncomes ? incomeSide.pending : 0;

    return {
      currency,
      incomes: incomeSide,
      expenses: expenseSide,
      previous: before,
      current,
      target: current + expectedIncomes - expenseSide.pending,
      pendingReimbursements: pendingByCurrency.get(currency) ?? 0,
    };
  });
};
