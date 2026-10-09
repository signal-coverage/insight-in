import { MONEY_STATUSES } from "@/core/entries/status";
import { isoDateToDate } from "@/core/incomes/dates";
import { prisma } from "@/infrastructure/db/client";

import { CHART_MONTHS } from "./consts";
import { lastMonths } from "./days";
import { monthRange } from "./month";
import type { MonthChartSources } from "./types";

// Everything the three charts of a month need, in four grouped queries that run together: the
// incomes and the expenses of the six months that end with `month`, by currency, day and status (the
// 6-month bars and, from the same rows, the month's daily balance), the month's expenses by currency
// and category, and the user's category names. COVERED entries never moved money, so none is read.
// Only the user's own rows are ever read: the owner leads every filter.
export const readMonthChartSources = async (
  userId: string,
  month: string,
): Promise<MonthChartSources> => {
  const [firstMonth] = lastMonths(month, CHART_MONTHS);
  const { from: monthFrom, to } = monthRange(month);
  const statuses = { in: [...MONEY_STATUSES] };
  const seriesQuery = {
    by: ["currency", "date", "status"] as ("currency" | "date" | "status")[],
    where: {
      userId,
      status: statuses,
      date: {
        gte: isoDateToDate(monthRange(firstMonth).from),
        lte: isoDateToDate(to),
      },
    },
    _sum: { amount: true as const },
  };

  const [incomes, expenses, categories, categoryNames] = await Promise.all([
    prisma.income.groupBy(seriesQuery),
    prisma.expense.groupBy(seriesQuery),
    prisma.expense.groupBy({
      by: ["currency", "categoryId"] as ("currency" | "categoryId")[],
      where: {
        userId,
        status: statuses,
        date: { gte: isoDateToDate(monthFrom), lte: isoDateToDate(to) },
      },
      _sum: { amount: true as const },
    }),
    prisma.expenseCategory.findMany({
      where: { userId },
      select: { id: true, name: true },
    }),
  ]);

  return { incomes, expenses, categories, categoryNames };
};
