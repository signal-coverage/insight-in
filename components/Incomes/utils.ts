import { formatIncomeDate } from "@/core/incomes/dates";
import { formatMoney, toDecimalString } from "@/core/incomes/money";
import { nextOccurrence } from "@/core/incomes/recurrence";
import type { Income, RecurringIncome } from "@/core/incomes/types";

import { FREQUENCY_LABELS } from "./consts";
import type { IncomeRow, RecurringRow } from "./types";

export const toIncomeRows = (incomes: readonly Income[]): IncomeRow[] =>
  incomes.map((income) => ({
    ...income,
    amountLabel: formatMoney(income.amount, income.currency),
    amountDecimal: toDecimalString(income.amount, income.currency),
    dateLabel: formatIncomeDate(income.date),
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
