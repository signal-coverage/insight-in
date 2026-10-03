import { foldCurrencyTotals } from "@/core/entries/listing";
import type { CurrencyTotal } from "@/core/entries/types";
import { minorUnitsToNumber } from "@/core/incomes/money";

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

interface CashAndDigital {
  digital: SideSummary;
  cash: SideSummary;
}

// One side's amounts per currency, with cash and digital kept apart.
const foldByMedium = (
  groups: readonly StatusGroup[],
): Map<string, CashAndDigital> => {
  const byCurrency = new Map<string, CashAndDigital>();

  for (const { currency, status, medium, _sum } of groups) {
    // A covered entry never moved the user's money: it is not settled, and not pending either.
    if (_sum.amount === null || status === "COVERED") {
      continue;
    }

    const amount = minorUnitsToNumber(_sum.amount);
    const current = byCurrency.get(currency) ?? {
      digital: EMPTY_SIDE,
      cash: EMPTY_SIDE,
    };
    const key = medium === "CASH" ? "cash" : "digital";
    const side = current[key];
    const settled = status === "SETTLED";

    byCurrency.set(currency, {
      ...current,
      [key]: {
        total: side.total + amount,
        settled: side.settled + (settled ? amount : 0),
        pending: side.pending + (settled ? 0 : amount),
      },
    });
  }

  return byCurrency;
};

// Puts a month's incomes and expenses side by side, per currency (they are never added across
// currencies). A currency that appears on only one side still gets a row, with zero on the other.
//
// The incomes and expenses rows count every entry, cash and digital together. The balances keep
// the two apart: the remainders are the accounts (previous digital balance plus the digital
// entries), the wallet is the cash, and the total available is both.
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
  const incomesByMedium = foldByMedium(incomeGroups);
  const expensesByMedium = foldByMedium(expenseGroups);
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
  ].sort((a, b) => a.localeCompare(b));

  return currencies.map((currency) => {
    const incomeSide = incomes.get(currency) ?? EMPTY_SIDE;
    const expenseSide = expenses.get(currency) ?? EMPTY_SIDE;
    const incomeMediums = incomesByMedium.get(currency);
    const expenseMediums = expensesByMedium.get(currency);
    const digitalIncomes = incomeMediums?.digital ?? EMPTY_SIDE;
    const digitalExpenses = expenseMediums?.digital ?? EMPTY_SIDE;
    const cashIncomes = incomeMediums?.cash ?? EMPTY_SIDE;
    const cashExpenses = expenseMediums?.cash ?? EMPTY_SIDE;
    const before = previousByCurrency.get(currency);

    const current =
      (before?.digital ?? 0) + digitalIncomes.settled - digitalExpenses.settled;
    const expectedIncomes = includeExpectedIncomes ? digitalIncomes.pending : 0;
    const wallet =
      (before?.cash ?? 0) + cashIncomes.settled - cashExpenses.settled;

    return {
      currency,
      incomes: incomeSide,
      expenses: expenseSide,
      previous: before?.digital ?? 0,
      current,
      target: current + expectedIncomes - digitalExpenses.pending,
      wallet,
      available: current + wallet,
      pendingReimbursements: pendingByCurrency.get(currency) ?? 0,
    };
  });
};
