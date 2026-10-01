import { toTotalRows } from "@/components/Entries/utils";
import { toIncomeRows, toRecurringRows } from "@/components/Incomes/utils";
import { loadIncomesPageData } from "@/core/incomes/pageData";
import type { EntriesQuery } from "@/core/entries/query";

// Starts loading everything the page needs and returns immediately, without awaiting it: one
// promise per section, all derived from the same single load. The page hands them straight to
// the client component, so the page's structure renders at once and each section waits for just
// its own piece (the table, the totals, the two selects, the drawers).
//
// The promises are created here, once per request, so their identity is stable: a client
// component that waits on one gets the same promise on every render.
export const loadIncomesView = (
  userId: string,
  query: EntriesQuery,
  today: string,
) => {
  const data = loadIncomesPageData(userId, query, today);

  return {
    totals: data.then(({ totals }) => toTotalRows(totals)),
    categories: data.then(({ categories }) =>
      categories.map(({ id, name, incomeCount }) => ({
        id,
        name,
        count: incomeCount,
      })),
    ),
    currencies: data.then(({ currencies }) => currencies),
    table: data.then(({ page, currencies }) => {
      const { rows, ...pagination } = page;

      return {
        rows: toIncomeRows(rows),
        pagination,
        // With no income in any currency, an empty table means "nothing yet", not "no matches".
        hasAnyIncomes: currencies.length > 0,
      };
    }),
    recurring: data.then(({ recurring }) => toRecurringRows(recurring, today)),
  };
};
