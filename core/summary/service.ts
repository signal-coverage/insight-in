import { isoDateToDate } from "@/core/incomes/dates";
import { prisma } from "@/infrastructure/db/client";

import { summarize } from "./compute";
import { monthRange } from "./month";
import type { CurrencySummary, SummarizeOptions } from "./types";

// The month's incomes and expenses side by side, per currency. Both tables are summed by the
// database, grouped by currency and status, and only the user's own rows are ever read: the owner
// leads the filter.
export const getMonthlySummary = async (
  userId: string,
  month: string,
  options?: SummarizeOptions,
): Promise<CurrencySummary[]> => {
  const { from, to } = monthRange(month);
  const where = {
    userId,
    date: { gte: isoDateToDate(from), lte: isoDateToDate(to) },
  };
  const query = {
    by: ["currency", "status"] as ("currency" | "status")[],
    where,
    _sum: { amount: true as const },
  };

  const [incomes, expenses] = await Promise.all([
    prisma.income.groupBy(query),
    prisma.expense.groupBy(query),
  ]);

  return summarize(incomes, expenses, options);
};
