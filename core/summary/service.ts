import { previousBalances, priorEntriesWindow } from "@/core/balances/previous";
import { getOpeningBalances } from "@/core/balances/service";
import type { SettledFlow } from "@/core/balances/types";
import type { PaymentMedium } from "@/core/entries/medium";
import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { getPendingReimbursements } from "@/core/reimbursements/service";
import { prisma } from "@/infrastructure/db/client";

import { summarize } from "./compute";
import { monthRange } from "./month";
import type { CurrencySummary, SummarizeOptions } from "./types";

interface PriorGroup {
  currency: string;
  medium: PaymentMedium;
  _sum: { amount: bigint | null };
}

const toFlows = (
  groups: readonly PriorGroup[],
  kind: SettledFlow["kind"],
): SettledFlow[] =>
  groups.flatMap(({ currency, medium, _sum }) =>
    _sum.amount === null
      ? []
      : [{ currency, medium, kind, amount: minorUnitsToNumber(_sum.amount) }],
  );

// The month's incomes and expenses side by side, per currency, with the balances carried in from
// the earlier months. Every table is summed by the database, grouped by currency, status and
// medium (the month) or by currency and medium (the settled entries before it), and only the
// user's own rows are ever read: the owner leads the filter. What is still expected back from
// expenses comes along (two more queries) and is only shown: no remainder includes it.
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
    by: ["currency", "status", "medium"] as (
      "currency" | "status" | "medium"
    )[],
    where,
    _sum: { amount: true as const },
  };

  const [incomes, expenses, opening, reimbursements] = await Promise.all([
    prisma.income.groupBy(query),
    prisma.expense.groupBy(query),
    getOpeningBalances(userId),
    getPendingReimbursements(userId, month),
  ]);

  // The opening balance decides how far back the earlier months are read, so it comes first.
  const window = priorEntriesWindow(month, opening?.month ?? null);
  let flows: SettledFlow[] = [];

  if (window !== null) {
    const priorQuery = {
      by: ["currency", "medium"] as ("currency" | "medium")[],
      where: {
        userId,
        status: "SETTLED" as const,
        date: {
          ...(window.from ? { gte: isoDateToDate(window.from) } : {}),
          lte: isoDateToDate(window.to),
        },
      },
      _sum: { amount: true as const },
    };
    const [priorIncomes, priorExpenses] = await Promise.all([
      prisma.income.groupBy(priorQuery),
      prisma.expense.groupBy(priorQuery),
    ]);

    flows = [
      ...toFlows(priorIncomes, "income"),
      ...toFlows(priorExpenses, "expense"),
    ];
  }

  return summarize(incomes, expenses, {
    ...options,
    reimbursements,
    previous: previousBalances(month, opening, flows),
  });
};
