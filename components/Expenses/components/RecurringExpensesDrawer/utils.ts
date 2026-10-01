import type { RecurringDecisionInput } from "@/core/expenses/types";

import type { RecurringRow } from "../../types";
import type { Amounts, Choices } from "./types";

// What "Aplicar" sends: one entry per pending row that got a choice, in the order of the rows.
// Only an enabled row carries an amount (the one typed for this month, or the template's own).
export const toDecisions = (
  rows: readonly RecurringRow[],
  choices: Choices,
  amounts: Amounts,
): RecurringDecisionInput[] =>
  rows.flatMap((row): RecurringDecisionInput[] => {
    const choice = choices[row.id];

    if (!choice) {
      return [];
    }

    return choice === "enable"
      ? [
          {
            recurringExpenseId: row.id,
            choice,
            amount: amounts[row.id] ?? row.amountDecimal,
          },
        ]
      : [{ recurringExpenseId: row.id, choice }];
  });
