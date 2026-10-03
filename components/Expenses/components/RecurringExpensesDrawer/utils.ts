import type { RecurringDecisionInput } from "@/core/expenses/types";

import type { RecurringRow } from "../../types";
import type { Amounts, Choices, RowErrors } from "./types";

// What "Aplicar" sends: one entry per pending row that got a choice, in the order of the rows.
// A row that is enabled or disabled carries its amount (the one typed, or the template's own); the
// server keeps it on the template when it changed. A removed row carries none: it goes away.
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

    return choice === "remove"
      ? [{ recurringExpenseId: row.id, choice }]
      : [
          {
            recurringExpenseId: row.id,
            choice,
            amount: amounts[row.id] ?? row.amountDecimal,
          },
        ];
  });

// The errors shown under the rows, with one row's changed: set to a message, or cleared with null.
// Returns a new object, so it can feed a state update directly.
export const withRowError = (
  errors: RowErrors,
  id: string,
  message: string | null,
): RowErrors => {
  const next = { ...errors };

  if (message === null) {
    delete next[id];
  } else {
    next[id] = message;
  }

  return next;
};
