import { countPending, splitByDecision } from "@/core/expenses/recurrence";
import type { Expense, RecurringExpenseItem } from "@/core/expenses/types";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import { formatMonth } from "@/core/summary/month";

import { dayLabel } from "./consts";
import type { ExpenseRow, RecurringData, RecurringRow } from "./types";

// Money and dates are formatted on the server so the client never re-derives presentation.
export const toExpenseRows = (expenses: readonly Expense[]): ExpenseRow[] =>
  expenses.map((expense) => ({
    ...expense,
    amountLabel: formatMoney(expense.amount, expense.currency),
    amountDecimal: toDecimalString(expense.amount, expense.currency),
    dateLabel: formatIncomeDate(expense.date),
  }));

const toRecurringRow = (item: RecurringExpenseItem): RecurringRow => ({
  ...item,
  amountLabel: formatMoney(item.amount, item.currency),
  amountDecimal: toDecimalString(item.amount, item.currency),
  dayLabel: dayLabel(item.dayOfMonth),
});

// The wizard's data for one month: the templates still waiting for a choice, then the decided ones.
export const toRecurringData = ({
  month,
  items,
}: {
  month: string;
  items: readonly RecurringExpenseItem[];
}): RecurringData => {
  const { pending, decided } = splitByDecision(items);

  return {
    month,
    monthLabel: formatMonth(month),
    pending: pending.map(toRecurringRow),
    decided: decided.map(toRecurringRow),
    pendingCount: countPending(items),
  };
};
