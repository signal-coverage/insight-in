import { toTotalRows } from "@/components/Entries/utils";
import { toExpenseRows, toRecurringData } from "@/components/Expenses/utils";
import type { EntriesQuery } from "@/core/entries/query";
import { loadExpensesPageData } from "@/core/expenses/pageData";

// Starts loading everything the page needs and returns immediately, without awaiting it: one
// promise per section, all derived from the same single load. The page hands them straight to the
// client component, so the page's structure renders at once and each section waits for just its
// own piece (the table, the totals, the two selects, the drawers).
//
// The promises are created here, once per request, so their identity is stable: a client
// component that waits on one gets the same promise on every render.
export const loadExpensesView = (userId: string, query: EntriesQuery) => {
  const data = loadExpensesPageData(userId, query);

  return {
    totals: data.then(({ totals }) => toTotalRows(totals)),
    categories: data.then(({ categories }) =>
      categories.map(({ id, name, expenseCount }) => ({
        id,
        name,
        count: expenseCount,
      })),
    ),
    currencies: data.then(({ currencies }) => currencies),
    recurring: data.then(({ recurring }) => toRecurringData(recurring)),
    table: data.then(({ page, currencies }) => {
      const { rows, ...pagination } = page;

      return {
        rows: toExpenseRows(rows),
        pagination,
        // With no expense in any currency, an empty table means "nothing yet", not "no matches".
        hasAnyExpenses: currencies.length > 0,
      };
    }),
  };
};
