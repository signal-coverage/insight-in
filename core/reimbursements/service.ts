import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";

import { outstandingOf, pendingByCurrency, receivedById } from "./compute";
import {
  ReimbursedExpenseNotFoundError,
  ReimbursementCurrencyMismatchError,
  ReimbursementNotExpectedError,
} from "./errors";
import type {
  PendingReimbursement,
  ReceivedTotal,
  ReimbursableExpense,
} from "./types";

// The client only sends the id of the expense an income pays back, so it is never trusted: it must be
// the user's, expect a reimbursement and be in the currency of the income.
export const assertReimbursable = async (
  userId: string,
  expenseId: string,
  currency: string,
): Promise<void> => {
  const expense = await prisma.expense.findFirst({
    where: { userId, id: expenseId },
    select: { currency: true, expectedReimbursement: true },
  });

  if (!expense) {
    throw new ReimbursedExpenseNotFoundError();
  }

  if (expense.expectedReimbursement === null) {
    throw new ReimbursementNotExpectedError();
  }

  if (expense.currency !== currency) {
    throw new ReimbursementCurrencyMismatchError();
  }
};

// How many of the user's incomes are linked to the expense.
export const countLinkedIncomes = (
  userId: string,
  expenseId: string,
): Promise<number> =>
  prisma.income.count({ where: { userId, reimbursesExpenseId: expenseId } });

// What the linked incomes of each expense add up to, whatever their status, in one grouped query.
// `until` leaves out the incomes dated after it.
export const listReceivedTotals = async (
  userId: string,
  expenseIds: readonly string[],
  until?: string,
): Promise<ReceivedTotal[]> => {
  if (expenseIds.length === 0) {
    return [];
  }

  const groups = await prisma.income.groupBy({
    by: ["reimbursesExpenseId"],
    where: {
      userId,
      reimbursesExpenseId: { in: [...expenseIds] },
      ...(until ? { date: { lte: isoDateToDate(until) } } : {}),
    },
    _sum: { amount: true },
  });

  return groups.flatMap(({ reimbursesExpenseId, _sum }) =>
    reimbursesExpenseId === null || _sum.amount === null
      ? []
      : [
          {
            expenseId: reimbursesExpenseId,
            amount: minorUnitsToNumber(_sum.amount),
          },
        ],
  );
};

// What the user is still expected to be paid back at the end of the month, per currency: the
// outstanding amount of every expense dated up to the last day of the month, counting only the linked
// incomes dated up to that day, so a past month stays as it was. Two queries, however many expenses
// there are, and only the user's own rows are read.
export const getPendingReimbursements = async (
  userId: string,
  month: string,
): Promise<PendingReimbursement[]> => {
  const { to } = monthRange(month);
  const rows = await prisma.expense.findMany({
    where: {
      userId,
      expectedReimbursement: { not: null },
      date: { lte: isoDateToDate(to) },
    },
    select: { id: true, currency: true, expectedReimbursement: true },
  });

  if (rows.length === 0) {
    return [];
  }

  const received = await listReceivedTotals(
    userId,
    rows.map(({ id }) => id),
    to,
  );

  return pendingByCurrency(
    rows.flatMap(({ id, currency, expectedReimbursement }) =>
      expectedReimbursement === null
        ? []
        : [
            {
              id,
              currency,
              expectedReimbursement: minorUnitsToNumber(expectedReimbursement),
            },
          ],
    ),
    received,
  );
};

// The expenses an income can be linked to: the user's that expect a reimbursement and still have
// something outstanding, newest first.
export const listReimbursableExpenses = async (
  userId: string,
): Promise<ReimbursableExpense[]> => {
  const rows = await prisma.expense.findMany({
    where: { userId, expectedReimbursement: { not: null } },
    select: {
      id: true,
      description: true,
      date: true,
      currency: true,
      expectedReimbursement: true,
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });
  const received = receivedById(
    await listReceivedTotals(
      userId,
      rows.map(({ id }) => id),
    ),
  );

  return rows.flatMap(
    ({ id, description, date, currency, expectedReimbursement }) => {
      const outstanding =
        expectedReimbursement === null
          ? 0
          : outstandingOf(
              minorUnitsToNumber(expectedReimbursement),
              received.get(id) ?? 0,
            );

      return outstanding > 0
        ? [
            {
              id,
              description,
              date: dateToIsoDate(date),
              currency,
              outstanding,
            },
          ]
        : [];
    },
  );
};
