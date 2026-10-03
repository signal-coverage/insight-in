import type { EntriesQuery } from "@/core/entries/query";
import { listIncomeInstallmentPlans } from "@/core/installments/incomeService";
import { distinctPlanIds } from "@/core/installments/planProgress";
import { listIncomePlanProgress } from "@/core/installments/progress";
import { listReimbursableExpenses } from "@/core/reimbursements/service";
import { monthOf } from "@/core/summary/month";

import {
  listCategoriesWithCounts,
  listIncomeCurrencies,
  listIncomes,
  listIncomeTotals,
  listRecurringIncomes,
  materializeRecurringIncomes,
} from "./service";

const readAll = (userId: string, query: EntriesQuery, month: string) =>
  Promise.all([
    listIncomes(userId, query),
    listIncomeTotals(userId, query),
    listCategoriesWithCounts(userId),
    listIncomeCurrencies(userId),
    listRecurringIncomes(userId),
    listIncomeInstallmentPlans(userId, month),
  ]);

// Everything the incomes page needs. The reads and the recurring catch-up start together, so
// the common case (nothing to generate) costs one round of database latency. Only when the
// catch-up actually created incomes are the reads repeated, so the new rows show up
// immediately. The catch-up stays idempotent, so the extra pass is safe to run.
//
// When templates exist the catch-up itself takes up to three sequential queries, so it can be
// the slowest branch here. The loans repaid in installments are always resolved for the current
// month (Argentine date), whatever range the list is filtered to.
export const loadIncomesPageData = async (
  userId: string,
  query: EntriesQuery,
  today: string,
) => {
  const month = monthOf(today);
  // The expenses an income can pay back do not change when recurring incomes are generated, so they
  // are read once, with the first reads.
  const [created, firstReads, reimbursables] = await Promise.all([
    materializeRecurringIncomes(userId, today),
    readAll(userId, query, month),
    listReimbursableExpenses(userId),
  ]);
  const [page, totals, categories, currencies, recurring, plans] =
    created > 0 ? await readAll(userId, query, month) : firstReads;

  // How far along each plan of the rows is, which the delete dialog quotes: one grouped query for the
  // whole page, and none when no row is an installment.
  const planProgress = await listIncomePlanProgress(
    userId,
    distinctPlanIds(page.rows),
  );

  return {
    page,
    planProgress,
    totals,
    categories,
    currencies,
    recurring,
    repayments: { month, plans },
    reimbursables,
  };
};
