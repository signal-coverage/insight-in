import { assertUsableAccount } from "@/core/accounts/usable";
import { dayOfMonthOf } from "@/core/expenses/recurrence";
import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { assertCategoryOwnedBy } from "@/core/incomes/service";
import { prisma } from "@/infrastructure/db/client";

import { moveIncomeDates } from "./dateMoves";
import { buildInstallments } from "./plan";
import { planCounts } from "./reflow";
import { toPlanItem } from "./service";
import type {
  IncomeInstallmentPlanInput,
  InstallmentCountInput,
  InstallmentDetail,
  InstallmentPlanItem,
  PlanDetail,
} from "./types";

// A loan that somebody repays to the user in installments (an income plan). It works like a purchase
// paid in installments, on the income side: every installment is a normal planned income, one per
// month, and an installment is either PLANNED (still to collect) or SETTLED (collected). Nothing is
// ever "covered by someone else" here, and there is no card.

// Creates a loan repaid in installments: the plan and all of its installments (planned incomes, one
// per month) in one transaction, or nothing at all. The category must be one of the user's income
// categories.
export const createIncomeInstallmentPlan = async (
  userId: string,
  input: IncomeInstallmentPlanInput,
): Promise<{ id: string }> => {
  await assertCategoryOwnedBy(userId, input.categoryId);
  await assertUsableAccount(userId, {
    accountId: input.accountId,
    currency: input.currency,
    keepAccountId: null,
  });

  const installments = buildInstallments({
    description: input.description,
    totalAmount: input.totalAmount,
    totalCuotas: input.totalCuotas,
    firstDate: input.firstDate,
  });

  return prisma.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.create({
      data: {
        userId,
        kind: "INCOME",
        description: input.description,
        totalCuotas: input.totalCuotas,
        totalAmount: BigInt(input.totalAmount),
        currency: input.currency,
        accountId: input.accountId,
        incomeCategoryId: input.categoryId,
        notes: input.notes,
        dayOfMonth: dayOfMonthOf(input.firstDate),
      },
    });

    await tx.income.createMany({
      data: installments.map(({ number, description, amount, date }) => ({
        userId,
        description,
        amount: BigInt(amount),
        currency: input.currency,
        date: isoDateToDate(date),
        categoryId: input.categoryId,
        notes: input.notes,
        // Created ahead of time: it still has to be collected.
        status: "PLANNED" as const,
        // Every installment arrives in the plan's account.
        accountId: input.accountId,
        installmentPlanId: plan.id,
        installmentNumber: number,
      })),
    });

    return { id: plan.id };
  });
};

// Every loan of the user that still has an installment to collect, with its installments. Scoped by
// userId, so one user can never read another user's plans.
export const listIncomeInstallmentPlanRows = async (
  userId: string,
): Promise<PlanDetail[]> => {
  const rows = await prisma.installmentPlan.findMany({
    where: { userId, kind: "INCOME", incomes: { some: { status: "PLANNED" } } },
    include: {
      incomeCategory: { select: { name: true } },
      incomes: {
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
    // An income plan always has its category (see the CHECK constraint of the table).
    categoryName: row.incomeCategory?.name ?? "",
    currency: row.currency,
    totalCuotas: row.totalCuotas,
    cardId: null,
    purchaseDate: null,
    installments: row.incomes.flatMap((income): InstallmentDetail[] =>
      income.installmentNumber === null
        ? []
        : [
            {
              id: income.id,
              number: income.installmentNumber,
              date: dateToIsoDate(income.date),
              status: income.status,
              amount: minorUnitsToNumber(income.amount),
            },
          ],
    ),
  }));
};

// The loans the "Devoluciones en cuotas" section lists: the ones with installments still to collect,
// with what the month being resolved already holds of each.
export const listIncomeInstallmentPlans = async (
  userId: string,
  month: string,
): Promise<InstallmentPlanItem[]> => {
  const plans = await listIncomeInstallmentPlanRows(userId);

  return plans.map((plan) => toPlanItem(plan, month));
};

// Applies the counts the user chose: for each loan, its pending installments are re-laid out so that
// the chosen number falls in the month (see planCounts, shared with the purchases). Only the dates
// that change are written, and only on installments that are still planned, so the same counts
// submitted twice change nothing the second time and one collected meanwhile never moves. Plans that
// are not the user's, and repeated ones, are ignored. Throws InvalidInstallmentCountError before
// writing anything.
export const applyIncomeInstallmentCounts = async (
  userId: string,
  month: string,
  counts: readonly InstallmentCountInput[],
): Promise<void> => {
  if (counts.length === 0) {
    return;
  }

  const moves = planCounts({
    plans: await listIncomeInstallmentPlanRows(userId),
    requested: counts,
    month,
  });

  if (moves.length === 0) {
    return;
  }

  // One statement, so it is atomic without a transaction and costs a single round trip however many
  // installments move. Nothing but the date changes. Scoped by userId.
  await moveIncomeDates(prisma, userId, moves);
};
