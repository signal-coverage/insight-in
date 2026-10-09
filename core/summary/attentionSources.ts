import { listCards } from "@/core/cards/service";
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { listReimbursableExpenses } from "@/core/reimbursements/service";
import { prisma } from "@/infrastructure/db/client";

import { ATTENTION_DAYS_AHEAD } from "./consts";
import { addDays } from "./days";
import { monthOf } from "./month";
import type { AttentionReads, PlannedEntry } from "./types";

const PLANNED_SELECT = {
  id: true,
  description: true,
  amount: true,
  currency: true,
  date: true,
} as const;

const OLDEST_FIRST = [{ date: "asc" as const }, { id: "asc" as const }];

const toPlanned = (row: {
  id: string;
  description: string;
  amount: bigint;
  currency: string;
  date: Date;
}): PlannedEntry => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  date: dateToIsoDate(row.date),
});

// What the attention block reads, besides the accounts (those come from the "Por cuenta" read): the
// planned expenses up to ATTENTION_DAYS_AHEAD days from today (the overdue ones of any earlier month
// too), the planned incomes dated before today, the expenses with a reimbursement still outstanding,
// and the cards with their usage in today's month. The date of an expense is the one the app shows
// (for a card charge, the day the statement is paid). The four reads are independent, so they run
// together, and every one is scoped by userId.
export const readAttentionSources = async (
  userId: string,
  today: string,
): Promise<AttentionReads> => {
  const [expenses, incomes, reimbursements, cards] = await Promise.all([
    prisma.expense.findMany({
      where: {
        userId,
        status: "PLANNED",
        date: { lte: isoDateToDate(addDays(today, ATTENTION_DAYS_AHEAD)) },
      },
      select: PLANNED_SELECT,
      orderBy: OLDEST_FIRST,
    }),
    prisma.income.findMany({
      where: { userId, status: "PLANNED", date: { lt: isoDateToDate(today) } },
      select: PLANNED_SELECT,
      orderBy: OLDEST_FIRST,
    }),
    listReimbursableExpenses(userId),
    listCards(userId, monthOf(today)),
  ]);

  return {
    plannedExpenses: expenses.map(toPlanned),
    plannedIncomes: incomes.map(toPlanned),
    reimbursements,
    cards,
  };
};
