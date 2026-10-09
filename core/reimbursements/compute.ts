import { compareCurrencyCodes } from "@/core/currencies/crypto";

import type {
  ExpectedExpense,
  PendingReimbursement,
  ReceivedTotal,
} from "./types";

// What is still expected for one expense. Every linked income counts as received, collected or not: a
// linked income that is still to collect is already in "Por cobrar", so counting it here too would
// count the same money twice. More than expected never makes the figure negative.
export const outstandingOf = (expected: number, received: number): number =>
  Math.max(0, expected - received);

export const receivedById = (
  totals: readonly ReceivedTotal[],
): Map<string, number> =>
  new Map(totals.map(({ expenseId, amount }) => [expenseId, amount]));

// The outstanding amount of every expense added up per currency (they are never added across
// currencies). A currency with nothing outstanding has no row.
export const pendingByCurrency = (
  expenses: readonly ExpectedExpense[],
  received: readonly ReceivedTotal[],
): PendingReimbursement[] => {
  const receivedByExpense = receivedById(received);
  const byCurrency = new Map<string, number>();

  for (const { id, currency, expectedReimbursement } of expenses) {
    const outstanding = outstandingOf(
      expectedReimbursement,
      receivedByExpense.get(id) ?? 0,
    );

    if (outstanding > 0) {
      byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + outstanding);
    }
  }

  return [...byCurrency.entries()]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => compareCurrencyCodes(a.currency, b.currency));
};
