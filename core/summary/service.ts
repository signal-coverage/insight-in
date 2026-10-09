import { previousBalances, priorEntriesWindow } from "@/core/balances/previous";
import { getOpeningBalances } from "@/core/balances/service";
import type { AccountFlow } from "@/core/balances/types";
import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { getPendingReimbursements } from "@/core/reimbursements/service";
import { prisma } from "@/infrastructure/db/client";

import { summarize } from "./compute";
import { monthRange } from "./month";
import type { CurrencySummary, SummarizeOptions } from "./types";

interface PriorGroup {
  accountId: string;
  currency: string;
  _sum: { amount: bigint | null };
}

const toFlows = (
  groups: readonly PriorGroup[],
  kind: AccountFlow["kind"],
): AccountFlow[] =>
  groups.flatMap(({ accountId, currency, _sum }) =>
    _sum.amount === null
      ? []
      : [
          {
            accountId,
            currency,
            kind,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ],
  );

// The month's incomes and expenses side by side, per currency, with the balances carried in from
// the earlier months. Every table is summed by the database, grouped by currency and status (the
// month) or by account and currency (the settled entries before it), so the previous balance is
// the sum of the accounts. Only the user's own rows are ever read: the owner leads the filter.
// What is still expected back from expenses comes along (two more queries) and is only shown: no
// remainder includes it.
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

  const [incomes, expenses, opening, reimbursements] = await Promise.all([
    prisma.income.groupBy(query),
    prisma.expense.groupBy(query),
    getOpeningBalances(userId),
    getPendingReimbursements(userId, month),
  ]);

  // The opening balance decides how far back the earlier months are read, so it comes first.
  const window = priorEntriesWindow(month, opening?.month ?? null);
  let flows: AccountFlow[] = [];

  if (window !== null) {
    const priorQuery = {
      by: ["accountId", "currency"] as ("accountId" | "currency")[],
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
