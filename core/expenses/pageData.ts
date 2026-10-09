import { listAccountChoices } from "@/core/accounts/choices";
import { listCardsWithCharges } from "@/core/cards/service";
import type { EntriesQuery } from "@/core/entries/query";
import { todayIso } from "@/core/incomes/dates";
import { distinctPlanIds } from "@/core/installments/planProgress";
import { listExpensePlanProgress } from "@/core/installments/progress";
import { listInstallmentPlans } from "@/core/installments/service";
import { monthOf } from "@/core/summary/month";

import { listRecurringExpenses } from "./recurringService";
import {
  listCategoriesWithCounts,
  listExpenseCurrencies,
  listExpenses,
  listExpenseTotals,
} from "./service";

// Everything the expenses page needs. The reads are independent, so they start together and the
// page costs one round of database latency. The recurring templates and the installment plans are
// always resolved for the current month (Argentine date), whatever range the list is filtered to.
// The cards come with their charges, which is what the forms need to offer them and the planner to
// recommend one. The accounts (archived ones flagged) feed the "Cuenta" field of every form.
export const loadExpensesPageData = async (
  userId: string,
  query: EntriesQuery,
) => {
  const month = monthOf(todayIso());
  const [page, totals, categories, currencies, items, plans, cards, accounts] =
    await Promise.all([
      listExpenses(userId, query),
      listExpenseTotals(userId, query),
      listCategoriesWithCounts(userId),
      listExpenseCurrencies(userId),
      listRecurringExpenses(userId, month),
      listInstallmentPlans(userId, month),
      listCardsWithCharges(userId),
      listAccountChoices(userId),
    ]);

  // How far along each plan of the rows is, which the delete dialog quotes. One grouped query for the
  // whole page, and none when no row is an installment.
  const planProgress = await listExpensePlanProgress(
    userId,
    distinctPlanIds(page.rows),
  );

  return {
    page,
    planProgress,
    totals,
    categories,
    currencies,
    recurring: { month, items, plans },
    cards,
    accounts,
  };
};
