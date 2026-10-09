import { previousAccountBalances, totalsByCurrency } from "./accounts";
import type { AccountFlow, OpeningBalances, PreviousBalance } from "./types";

// Kept here for the callers that read the window next to the balance it feeds.
export { priorEntriesWindow } from "./window";

// The "saldo previo" of `month`, per currency: the sum of the previous balances of its accounts
// (see previousAccountBalances for the opening-month rules). A currency shows up when it has an
// opening amount or a balance that is not zero.
export const previousBalances = (
  month: string,
  opening: OpeningBalances | null,
  flows: readonly AccountFlow[],
): PreviousBalance[] => {
  const opened = new Set(
    (opening?.amounts ?? []).map(({ currency }) => currency),
  );

  return totalsByCurrency(
    previousAccountBalances(month, opening, flows),
  ).filter(({ currency, amount }) => opened.has(currency) || amount !== 0);
};
