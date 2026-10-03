import { firstInstallmentDate } from "@/core/cards/cycle";
import { CardCurrencyMismatchError } from "@/core/cards/errors";
import { findOwnedCard } from "@/core/cards/service";
import { DEFAULT_PAYMENT_MEDIUM } from "@/core/entries/medium";
import { assertCategoryOwnedBy } from "@/core/expenses/service";
import { dayOfMonthOf } from "@/core/expenses/recurrence";
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { isSupportedMonth, monthOf } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";

import { InstallmentOutOfRangeError } from "./errors";
import { buildInstallments, lastInstallmentMonth } from "./plan";
import { countInMonth, pendingCount } from "./reflow";
import type {
  InstallmentDetail,
  InstallmentPlanInput,
  InstallmentPlanItem,
  PlanDetail,
} from "./types";

interface Schedule {
  firstDate: string;
  cardId: string | null;
  purchaseDate: string | null;
}

// When the first installment falls. With no card of the user's (a borrowed one) it is the date the
// user typed. With one of the user's cards the
// client only sends the card id and the purchase day, so neither is trusted: the card must be the
// user's and in the currency of the purchase, and the first installment is worked out here from its
// billing cycle (the date the client computed is ignored).
const resolveSchedule = async (
  userId: string,
  input: InstallmentPlanInput,
): Promise<Schedule> => {
  if (!input.cardId || !input.purchaseDate) {
    return { firstDate: input.firstDate, cardId: null, purchaseDate: null };
  }

  const card = await findOwnedCard(userId, input.cardId);

  if (card.currency !== input.currency) {
    throw new CardCurrencyMismatchError();
  }

  const firstDate = firstInstallmentDate(
    input.purchaseDate,
    card.closingDay,
    card.dueDay,
  );

  // The cycle can push the purchase past the last month the app can show.
  if (
    !isSupportedMonth(monthOf(firstDate)) ||
    !isSupportedMonth(lastInstallmentMonth(firstDate, input.totalCuotas))
  ) {
    throw new InstallmentOutOfRangeError();
  }

  return { firstDate, cardId: card.id, purchaseDate: input.purchaseDate };
};

// Creates a purchase paid in installments: the plan and all of its installments (planned
// expenses, one per month) in one transaction, or nothing at all. The category must be the user's.
export const createInstallmentPlan = async (
  userId: string,
  input: InstallmentPlanInput,
): Promise<{ id: string }> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  const { cardId, purchaseDate, firstDate } = await resolveSchedule(
    userId,
    input,
  );
  // A credit card is always digital money: the schema already forces it, and this is the last line of
  // defence, so a plan with a card is never stored as cash whoever calls the service.
  const medium = cardId ? DEFAULT_PAYMENT_MEDIUM : input.medium;
  const installments = buildInstallments({
    description: input.description,
    totalAmount: input.totalAmount,
    totalCuotas: input.totalCuotas,
    firstDate,
  });

  return prisma.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.create({
      data: {
        userId,
        description: input.description,
        totalCuotas: input.totalCuotas,
        totalAmount: BigInt(input.totalAmount),
        currency: input.currency,
        medium,
        categoryId: input.categoryId,
        notes: input.notes,
        dayOfMonth: dayOfMonthOf(firstDate),
        ...(cardId ? { cardId } : {}),
        ...(purchaseDate ? { purchaseDate: isoDateToDate(purchaseDate) } : {}),
      },
    });

    await tx.expense.createMany({
      data: installments.map(({ number, description, amount, date }) => ({
        userId,
        description,
        amount: BigInt(amount),
        currency: input.currency,
        date: isoDateToDate(date),
        categoryId: input.categoryId,
        notes: input.notes,
        // Created ahead of time: it still has to be paid.
        status: "PLANNED" as const,
        medium,
        isRecurring: false,
        installmentPlanId: plan.id,
        installmentNumber: number,
        // Each installment carries the card of its plan, so a card's usage reads its expenses
        // directly. The purchase day stays on the plan.
        ...(cardId ? { cardId } : {}),
      })),
    });

    return { id: plan.id };
  });
};

// Every purchase plan of the user that still has an installment to pay, with its installments (the
// loans repaid to the user are income plans, listed apart). Scoped by userId, so one user can never
// read another user's plans.
export const listInstallmentPlanRows = async (
  userId: string,
): Promise<PlanDetail[]> => {
  const rows = await prisma.installmentPlan.findMany({
    where: {
      userId,
      kind: "EXPENSE",
      expenses: { some: { status: "PLANNED" } },
    },
    include: {
      category: { select: { name: true } },
      expenses: {
        select: {
          id: true,
          installmentNumber: true,
          date: true,
          amount: true,
          status: true,
        },
        orderBy: { installmentNumber: "asc" },
      },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    description: row.description,
    dayOfMonth: row.dayOfMonth,
    // An expense plan always has its category (see the CHECK constraint of the table).
    categoryName: row.category?.name ?? "",
    currency: row.currency,
    totalCuotas: row.totalCuotas,
    cardId: row.cardId ?? null,
    purchaseDate: row.purchaseDate ? dateToIsoDate(row.purchaseDate) : null,
    installments: row.expenses.flatMap((expense): InstallmentDetail[] =>
      expense.installmentNumber === null
        ? []
        : [
            {
              id: expense.id,
              number: expense.installmentNumber,
              date: dateToIsoDate(expense.date),
              status: expense.status,
              amount: minorUnitsToNumber(expense.amount),
            },
          ],
    ),
  }));
};

// A plan as the monthly list shows it, for the month being resolved.
export const toPlanItem = (
  plan: PlanDetail,
  month: string,
): InstallmentPlanItem => {
  const pending = plan.installments
    .filter(({ status }) => status === "PLANNED")
    .sort((a, b) => a.number - b.number);

  return {
    id: plan.id,
    description: plan.description,
    categoryName: plan.categoryName,
    currency: plan.currency,
    totalCuotas: plan.totalCuotas,
    doneCount: plan.installments.filter(
      ({ status }) => status === "SETTLED" || status === "COVERED",
    ).length,
    pendingCount: pendingCount(plan.installments),
    nextAmount: pending[0]?.amount ?? 0,
    defaultCount: countInMonth(plan.installments, month),
  };
};

// The plans the monthly wizard lists: the ones with installments still to pay, with what the month
// being resolved already holds of each.
export const listInstallmentPlans = async (
  userId: string,
  month: string,
): Promise<InstallmentPlanItem[]> => {
  const plans = await listInstallmentPlanRows(userId);

  return plans.map((plan) => toPlanItem(plan, month));
};
