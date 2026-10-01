import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";

import type { EntriesQuery } from "./query";
import type { EntryStatus } from "./status";
import type { CurrencyTotal } from "./types";

// Query building shared by incomes and expenses: both tables have the same filterable columns.

// The filters shared by the page, the totals and the count. userId always leads, so no
// combination of filters can reach another user's rows.
export const buildEntriesWhere = (userId: string, query: EntriesQuery) => ({
  userId,
  ...(query.categoryId ? { categoryId: query.categoryId } : {}),
  ...(query.currency ? { currency: query.currency } : {}),
  ...(query.status ? { status: query.status } : {}),
  ...(query.from || query.to
    ? {
        date: {
          ...(query.from ? { gte: isoDateToDate(query.from) } : {}),
          ...(query.to ? { lte: isoDateToDate(query.to) } : {}),
        },
      }
    : {}),
});

// Ties are broken by newest first and finally by id, so paging is stable.
export const buildEntriesOrderBy = ({ sort, direction }: EntriesQuery) => {
  const newestFirst = [{ createdAt: "desc" as const }, { id: "desc" as const }];

  switch (sort) {
    case "description":
      return [
        { description: direction },
        { date: "desc" as const },
        ...newestFirst,
      ];
    case "category":
      return [
        { category: { name: direction } },
        { date: "desc" as const },
        ...newestFirst,
      ];
    default:
      return [{ date: direction }, { createdAt: direction }, { id: direction }];
  }
};

interface StatusGroup {
  currency: string;
  status: EntryStatus;
  _sum: { amount: bigint | null };
}

// Turns the database's (currency, status) sums into one row per currency.
export const foldCurrencyTotals = (
  groups: readonly StatusGroup[],
): CurrencyTotal[] => {
  const byCurrency = new Map<string, CurrencyTotal>();

  for (const group of groups) {
    if (group._sum.amount === null) {
      continue;
    }

    const amount = minorUnitsToNumber(group._sum.amount);
    const current = byCurrency.get(group.currency) ?? {
      currency: group.currency,
      total: 0,
      settled: 0,
    };

    byCurrency.set(group.currency, {
      ...current,
      total: current.total + amount,
      settled: current.settled + (group.status === "SETTLED" ? amount : 0),
    });
  }

  return [...byCurrency.values()].sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
};
