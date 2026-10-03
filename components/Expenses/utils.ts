import { cardTitle } from "@/components/Cards/consts";
import {
  toInstallmentPlanRow,
  toOriginStrings,
  toPlanProgressField,
} from "@/components/Entries/utils";
import { BRAND_NAMES } from "@/core/cards/consts";
import type { CardWithCharges } from "@/core/cards/types";
import { formatOrigin, toOriginDecimalString } from "@/core/currencies/origin";
import { countPending, splitByDecision } from "@/core/expenses/recurrence";
import type { Expense, RecurringExpenseItem } from "@/core/expenses/types";
import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import { outstandingOf } from "@/core/reimbursements/compute";
import type {
  InstallmentPlanItem,
  PlanProgress,
} from "@/core/installments/types";
import { formatMonth } from "@/core/summary/month";

import {
  ORIGIN_PREFIX,
  REFERENCE_PREFIX,
  REIMBURSEMENT_COMPLETE_LABEL,
  dayLabel,
  reimbursementOwedInFullLabel,
  reimbursementOwedLabel,
} from "./consts";
import type {
  CardOption,
  ExpenseRow,
  RecurringData,
  RecurringRow,
} from "./types";

// What the reimbursement marker of an expense says: how much is still owed out of what is expected,
// or that it is complete. Null when the expense expects nothing.
const toReimbursementTooltip = ({
  expectedReimbursement,
  reimbursementReceived,
  currency,
}: Expense): string | null => {
  if (expectedReimbursement === null) {
    return null;
  }

  const owed = outstandingOf(expectedReimbursement, reimbursementReceived);

  if (owed === 0) {
    return REIMBURSEMENT_COMPLETE_LABEL;
  }

  return owed === expectedReimbursement
    ? reimbursementOwedInFullLabel(formatMoney(owed, currency))
    : reimbursementOwedLabel(
        formatMoney(owed, currency),
        formatMoney(expectedReimbursement, currency),
      );
};

// Money and dates are formatted on the server so the client never re-derives presentation. An
// installment also gets the progress of its plan (see PlanProgress), which the delete dialog quotes.
export const toExpenseRows = (
  expenses: readonly Expense[],
  planProgress: Readonly<Record<string, PlanProgress>> = {},
): ExpenseRow[] =>
  expenses.map((expense) => ({
    ...expense,
    ...toPlanProgressField(expense.installmentPlanId, planProgress),
    amountLabel: formatMoney(expense.amount, expense.currency),
    amountDecimal: toDecimalString(expense.amount, expense.currency),
    dateLabel: formatIncomeDate(expense.date),
    ...toOriginStrings(expense, ORIGIN_PREFIX),
    expectedReimbursementDecimal:
      expense.expectedReimbursement === null
        ? null
        : toDecimalString(expense.expectedReimbursement, expense.currency),
    reimbursementTooltip: toReimbursementTooltip(expense),
  }));

// The cards the forms offer, titled like the cards page does.
export const toCardOptions = (
  cards: readonly CardWithCharges[],
): CardOption[] =>
  cards.map((card) => ({
    ...card,
    title: cardTitle(BRAND_NAMES[card.brand], card.last4),
  }));

const toRecurringRow = (item: RecurringExpenseItem): RecurringRow => ({
  ...item,
  amountLabel: formatMoney(item.amount, item.currency),
  amountDecimal: toDecimalString(item.amount, item.currency),
  dayLabel: dayLabel(item.dayOfMonth),
  originAmountDecimal:
    item.originCurrency === null || item.originAmount === null
      ? null
      : toOriginDecimalString(item.originAmount, item.originCurrency),
  referenceLabel:
    item.originCurrency === null || item.originAmount === null
      ? null
      : `${REFERENCE_PREFIX} ${formatOrigin(item.originAmount, item.originCurrency)}`,
});

// The wizard's data for one month: the templates still waiting for a choice, then the decided ones,
// and the purchases in installments that still have something to pay.
export const toRecurringData = ({
  month,
  items,
  plans = [],
}: {
  month: string;
  items: readonly RecurringExpenseItem[];
  plans?: readonly InstallmentPlanItem[];
}): RecurringData => {
  const { pending, decided } = splitByDecision(items);

  return {
    month,
    monthLabel: formatMonth(month),
    pending: pending.map(toRecurringRow),
    decided: decided.map(toRecurringRow),
    pendingCount: countPending(items),
    plans: plans.map(toInstallmentPlanRow),
  };
};
