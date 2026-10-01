import type { EntriesQuery } from "@/core/entries/query";
import {
  listCategoriesWithCounts,
  listIncomeCurrencies,
  listIncomes,
  listIncomeTotals,
  listRecurringIncomes,
  materializeRecurringIncomes,
} from "./service";

const readAll = (userId: string, query: EntriesQuery) =>
  Promise.all([
    listIncomes(userId, query),
    listIncomeTotals(userId, query),
    listCategoriesWithCounts(userId),
    listIncomeCurrencies(userId),
    listRecurringIncomes(userId),
  ]);

// Everything the incomes page needs. The reads and the recurring catch-up start together, so
// the common case (nothing to generate) costs one round of database latency. Only when the
// catch-up actually created incomes are the reads repeated, so the new rows show up
// immediately. The catch-up stays idempotent, so the extra pass is safe to run.
//
// When templates exist the catch-up itself takes up to three sequential queries, so it can be
// the slowest branch here.
export const loadIncomesPageData = async (
  userId: string,
  query: EntriesQuery,
  today: string,
) => {
  const [created, firstReads] = await Promise.all([
    materializeRecurringIncomes(userId, today),
    readAll(userId, query),
  ]);
  const [page, totals, categories, currencies, recurring] =
    created > 0 ? await readAll(userId, query) : firstReads;

  return { page, totals, categories, currencies, recurring };
};
