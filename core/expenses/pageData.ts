import type { EntriesQuery } from "@/core/entries/query";
import { todayIso } from "@/core/incomes/dates";
import { monthOf } from "@/core/summary/month";

import { listRecurringExpenses } from "./recurringService";
import {
  listCategoriesWithCounts,
  listExpenseCurrencies,
  listExpenses,
  listExpenseTotals,
} from "./service";

// Everything the expenses page needs. The reads are independent, so they start together and the
// page costs one round of database latency. The recurring templates are always resolved for the
// current month (Argentine date), whatever range the list is filtered to.
export const loadExpensesPageData = async (
  userId: string,
  query: EntriesQuery,
) => {
  const month = monthOf(todayIso());
  const [page, totals, categories, currencies, items] = await Promise.all([
    listExpenses(userId, query),
    listExpenseTotals(userId, query),
    listCategoriesWithCounts(userId),
    listExpenseCurrencies(userId),
    listRecurringExpenses(userId, month),
  ]);

  return { page, totals, categories, currencies, recurring: { month, items } };
};
