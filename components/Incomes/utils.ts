import {
  toInstallmentPlanRow,
  toOriginStrings,
  toPlanProgressField,
} from "@/components/Entries/utils";
import { formatIncomeDate, formatShortDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import { nextOccurrence } from "@/core/incomes/recurrence";
import type { Income, RecurringIncome } from "@/core/incomes/types";
import type {
  InstallmentPlanItem,
  PlanProgress,
} from "@/core/installments/types";
import type { ReimbursableExpense } from "@/core/reimbursements/types";
import { formatMonth } from "@/core/summary/month";

import {
  FREQUENCY_LABELS,
  ORIGIN_PREFIX,
  reimbursableLabel,
  reimbursesTooltip,
} from "./consts";
import type {
  IncomeRow,
  ReimbursableOption,
  RecurringRow,
  RepaymentData,
} from "./types";

// An installment also gets the progress of its plan (see PlanProgress), which the delete dialog quotes.
export const toIncomeRows = (
  incomes: readonly Income[],
  planProgress: Readonly<Record<string, PlanProgress>> = {},
): IncomeRow[] =>
  incomes.map((income) => ({
    ...income,
    ...toPlanProgressField(income.installmentPlanId, planProgress),
    amountLabel: formatMoney(income.amount, income.currency),
    amountDecimal: toDecimalString(income.amount, income.currency),
    dateLabel: formatIncomeDate(income.date),
    ...toOriginStrings(income, ORIGIN_PREFIX),
    reimbursementTooltip:
      income.reimbursesExpenseDescription === null
        ? null
        : reimbursesTooltip(income.reimbursesExpenseDescription),
  }));

// The expenses the income form offers to link an income to, each in its own currency.
export const toReimbursableOptions = (
  expenses: readonly ReimbursableExpense[],
): ReimbursableOption[] =>
  expenses.map(({ id, description, date, currency, outstanding }) => ({
    id,
    currency,
    label: reimbursableLabel(
      description,
      formatShortDate(date),
      formatMoney(outstanding, currency),
    ),
  }));

// `today` is the Argentine calendar date the server used to generate occurrences.
export const toRecurringRows = (
  recurring: readonly RecurringIncome[],
  today: string,
): RecurringRow[] =>
  recurring.map((template) => {
    const next = nextOccurrence({ ...template, after: today });

    return {
      ...template,
      amountLabel: formatMoney(template.amount, template.currency),
      amountDecimal: toDecimalString(template.amount, template.currency),
      frequencyLabel: FREQUENCY_LABELS[template.frequency],
      nextLabel: next
        ? `Próximo: ${formatIncomeDate(next)}`
        : "Serie finalizada",
      endLabel: template.endDate
        ? `Termina el ${formatIncomeDate(template.endDate)}`
        : null,
    };
  });

// The data of the "Devoluciones en cuotas" drawer: the month being resolved, named for its title, and
// the loans with installments still to collect.
export const toRepaymentData = ({
  month,
  plans,
}: {
  month: string;
  plans: readonly InstallmentPlanItem[];
}): RepaymentData => ({
  month,
  monthLabel: formatMonth(month),
  plans: plans.map(toInstallmentPlanRow),
});
