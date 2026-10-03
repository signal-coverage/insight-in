import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange, shiftMonth } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";

import { rateEvolution, summarizePairs } from "./compute";
import { EVOLUTION_MONTHS } from "./consts";
import type { ConversionEntry, Conversions } from "./types";

interface OriginRow {
  id: string;
  date: Date;
  description: string;
  amount: bigint;
  currency: string;
  originCurrency: string | null;
  originAmount: bigint | null;
}

// Both tables are read the same way, so one description serves them.
const select = {
  id: true,
  date: true,
  description: true,
  amount: true,
  currency: true,
  originCurrency: true,
  originAmount: true,
} as const;

// A row with half an origin cannot be told about (the database forbids it, but the numbers must not
// depend on that).
const toEntries = (rows: readonly OriginRow[]): ConversionEntry[] =>
  rows.flatMap(({ originCurrency, originAmount, date, amount, ...rest }) =>
    originCurrency === null || originAmount === null
      ? []
      : [
          {
            ...rest,
            date: dateToIsoDate(date),
            amount: minorUnitsToNumber(amount),
            originCurrency,
            originAmount: minorUnitsToNumber(originAmount),
          },
        ],
  );

// What the user converted, per (origin currency, net currency) pair: the incomes whose net amount
// came from another currency and the expenses that were priced in another one, the viewed month's
// statistics and the rate month by month over the last six months.
//
// Two ranged queries do all of it (one per table, covering the six months): the viewed month's
// numbers are the part of those same rows that falls in the month. Only the user's own rows are
// read (the owner leads the filter), only those that carry an origin and whose money really moved
// (a planned entry has not been converted yet, and a covered one never moved money). The origin is
// only informational: nothing here touches the summary's totals.
export const getConversions = async (
  userId: string,
  month: string,
): Promise<Conversions> => {
  const where = {
    userId,
    status: "SETTLED" as const,
    originCurrency: { not: null },
    originAmount: { not: null },
    date: {
      gte: isoDateToDate(
        monthRange(shiftMonth(month, 1 - EVOLUTION_MONTHS)).from,
      ),
      lte: isoDateToDate(monthRange(month).to),
    },
  };
  const query = { where, select, orderBy: { date: "asc" as const } };

  const [incomeRows, expenseRows] = await Promise.all([
    prisma.income.findMany(query),
    prisma.expense.findMany(query),
  ]);
  const incomes = toEntries(incomeRows);
  const expenses = toEntries(expenseRows);

  return {
    incomes: summarizePairs(incomes, "income", month),
    expenses: summarizePairs(expenses, "expense", month),
    evolution: [
      ...rateEvolution(incomes, "income", month),
      ...rateEvolution(expenses, "expense", month),
    ],
  };
};
