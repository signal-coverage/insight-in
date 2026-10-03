import { moveExpenseDates } from "@/core/installments/dateMoves";
import { listInstallmentPlanRows } from "@/core/installments/service";
import { planCounts } from "@/core/installments/reflow";
import type { InstallmentCountInput } from "@/core/installments/types";
import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type {
  Prisma,
  RecurringExpense as TemplateRow,
  RecurringExpenseDecision as DecisionRow,
} from "@/lib/generated/prisma/client";

import { RecurringExpenseSettledError, RecurringNotFoundError } from "./errors";
import { dateInMonth, planDecisions } from "./recurrence";
import { assertCategoryOwnedBy } from "./service";
import type {
  RecurringDecisionInput,
  RecurringDecisionValue,
  RecurringExpenseInput,
  RecurringExpenseItem,
} from "./types";

type TemplateWithDetails = TemplateRow & {
  category: { name: string };
  decisions: Pick<DecisionRow, "decision">[];
};

const toItem = (row: TemplateWithDetails): RecurringExpenseItem => ({
  id: row.id,
  description: row.description,
  amount: minorUnitsToNumber(row.amount),
  currency: row.currency,
  categoryId: row.categoryId,
  categoryName: row.category.name,
  notes: row.notes,
  medium: row.medium,
  originCurrency: row.originCurrency,
  originAmount:
    row.originAmount === null ? null : minorUnitsToNumber(row.originAmount),
  dayOfMonth: row.dayOfMonth,
  decision: row.decisions[0]?.decision ?? null,
});

// Every template the user has, with what they decided about it for `month` (null: nothing yet).
// Scoped by userId, so one user can never read another user's templates.
export const listRecurringExpenses = async (
  userId: string,
  month: string,
): Promise<RecurringExpenseItem[]> => {
  const rows = await prisma.recurringExpense.findMany({
    where: { userId },
    include: {
      category: { select: { name: true } },
      decisions: { where: { month }, select: { decision: true } },
    },
    orderBy: [{ dayOfMonth: "asc" }, { description: "asc" }],
  });

  return rows.map(toItem);
};

// Deletes templates for good (the wizard's Quitar, and the one on every row of the drawer). The
// expenses they already created stay as ordinary rows: the foreign key sets their link to null, so
// their flag is cleared first, while the link is still there to find them by. Scoped by userId.
// Returns how many templates were deleted.
const deleteTemplates = async (
  tx: Prisma.TransactionClient,
  userId: string,
  ids: readonly string[],
): Promise<number> => {
  await tx.expense.updateMany({
    where: { userId, recurringExpenseId: { in: [...ids] } },
    data: { isRecurring: false },
  });

  const { count } = await tx.recurringExpense.deleteMany({
    where: { id: { in: [...ids] }, userId },
  });

  return count;
};

// Applies what the user chose in the monthly wizard, all or nothing:
// - enable: creates the month's expense from the template (pending to pay) and records it;
// - disable: only records it, so the template shows up again next month;
// - enable and disable: when the amount typed differs from the template's, the template takes the
//   new amount too (same currency), so next month starts from it;
// - remove: deletes the template for good. The expenses it already created stay as ordinary rows
//   (the foreign key sets their link to null; their flag is cleared first, while the link is
//   still there to find them by).
// The wizard also lists the purchases paid in installments; the counts the user changed travel with
// the decisions and are applied in the same transaction: the plan's pending installments are
// re-laid out so that the chosen number falls in the month (see planCounts). Only the dates that
// change are written, so the same counts submitted twice change nothing the second time.
// Ids that are not the user's, templates already decided for the month and repeated ids are
// ignored (see planDecisions), and the writes skip duplicates, so submitting twice, even at the
// same time, creates nothing twice. Throws InvalidRecurringAmountError or
// InvalidInstallmentCountError before writing anything.
export const applyRecurringDecisions = async (
  userId: string,
  month: string,
  requested: readonly RecurringDecisionInput[],
  installmentCounts: readonly InstallmentCountInput[] = [],
): Promise<void> => {
  // Independent reads, issued together: each one is a round trip to the remote database.
  const [templates, plans] = await Promise.all([
    listRecurringExpenses(userId, month),
    installmentCounts.length === 0
      ? Promise.resolve([])
      : listInstallmentPlanRows(userId),
  ]);
  const plan = planDecisions({ templates, requested, month });
  const moves =
    installmentCounts.length === 0
      ? []
      : planCounts({ plans, requested: installmentCounts, month });
  const hasChoices =
    plan.enable.length > 0 ||
    plan.disable.length > 0 ||
    plan.remove.length > 0 ||
    plan.amountUpdates.length > 0;

  if (!hasChoices && moves.length === 0) {
    return;
  }

  // Only installments to move: a single statement is atomic by itself, so no transaction is opened.
  if (!hasChoices) {
    await moveExpenseDates(prisma, userId, moves);

    return;
  }

  const byId = new Map(templates.map((template) => [template.id, template]));
  const decisions: {
    recurringExpenseId: string;
    month: string;
    decision: RecurringDecisionValue;
  }[] = [
    ...plan.enable.map(({ templateId }) => ({
      recurringExpenseId: templateId,
      month,
      decision: "ENABLED" as const,
    })),
    ...plan.disable.map((templateId) => ({
      recurringExpenseId: templateId,
      month,
      decision: "DISABLED" as const,
    })),
  ];

  await prisma.$transaction(async (tx) => {
    if (plan.enable.length > 0) {
      await tx.expense.createMany({
        data: plan.enable.map(({ templateId, date, amount }) => {
          const template = byId.get(templateId)!;

          return {
            userId,
            description: template.description,
            amount: BigInt(amount),
            currency: template.currency,
            categoryId: template.categoryId,
            notes: template.notes,
            medium: template.medium,
            // The template remembers the reference price; the expense carries it along.
            originCurrency: template.originCurrency,
            originAmount:
              template.originAmount === null
                ? null
                : BigInt(template.originAmount),
            date: isoDateToDate(date),
            // Created ahead of time: it still has to be paid.
            status: "PLANNED" as const,
            isRecurring: true,
            recurringExpenseId: templateId,
          };
        }),
        skipDuplicates: true,
      });
    }

    if (decisions.length > 0) {
      await tx.recurringExpenseDecision.createMany({
        data: decisions,
        skipDuplicates: true,
      });
    }

    // The amount typed in the wizard sticks: next month the template offers it. Scoped by userId.
    for (const { templateId, amount } of plan.amountUpdates) {
      await tx.recurringExpense.updateMany({
        where: { id: templateId, userId },
        data: { amount: BigInt(amount) },
      });
    }

    if (plan.remove.length > 0) {
      await deleteTemplates(tx, userId, plan.remove);
    }

    // Nothing but the date of an installment changes: one statement for all of them. Scoped by userId.
    await moveExpenseDates(tx, userId, moves);
  });
};

// Edits a template on its own, at any time. Only the template changes: the expenses it already
// created are ordinary rows by now and stay as they are, so the new values count from the next
// month's expense on. The category must be the user's. Returns false when the template is not.
export const updateRecurringExpense = async (
  userId: string,
  id: string,
  input: RecurringExpenseInput,
): Promise<boolean> => {
  await assertCategoryOwnedBy(userId, input.categoryId);

  // Explicit field list: the owner and id can never be overridden by the payload.
  const { count } = await prisma.recurringExpense.updateMany({
    where: { id, userId },
    data: {
      description: input.description,
      amount: BigInt(input.amount),
      currency: input.currency,
      categoryId: input.categoryId,
      notes: input.notes,
      medium: input.medium,
      // Written as a pair; nulls clear the reference price.
      originCurrency: input.originCurrency,
      originAmount:
        input.originAmount === null ? null : BigInt(input.originAmount),
      dayOfMonth: input.dayOfMonth,
    },
  });

  return count > 0;
};

// Deletes a template at any time, exactly like the wizard's Quitar: the expenses it created stay
// and stop being recurring. Returns false when the template is not the user's.
export const removeRecurringExpense = async (
  userId: string,
  id: string,
): Promise<boolean> => {
  const deleted = await prisma.$transaction((tx) =>
    deleteTemplates(tx, userId, [id]),
  );

  return deleted > 0;
};

// Changes what was decided about a template for `month`, after the fact, in one transaction. The
// month's expense of the template (the one dated in that month and linked to it) is what moves:
// - ENABLED: creates it, from the template and on its day, still pending to pay; when the month
//   already has one (the state drifted) no second one is created;
// - DISABLED: deletes it, but only while every one of them is still pending. One that is paid or
//   covered already counts in the budget, so the call throws RecurringExpenseSettledError and
//   writes nothing: the user takes that money out deliberately, by deleting the expense first. A
//   month with no expense of the template (deleted, or moved to another month) just records it.
// Both are idempotent, and throw RecurringNotFoundError for a template that is not the user's.
export const setRecurringDecision = async (
  userId: string,
  id: string,
  month: string,
  decision: RecurringDecisionValue,
): Promise<void> => {
  const { from, to } = monthRange(month);

  await prisma.$transaction(async (tx) => {
    const template = await tx.recurringExpense.findFirst({
      where: { id, userId },
    });

    if (!template) {
      throw new RecurringNotFoundError();
    }

    const inMonth = await tx.expense.findMany({
      where: {
        userId,
        recurringExpenseId: id,
        date: { gte: isoDateToDate(from), lte: isoDateToDate(to) },
      },
      select: { id: true, status: true },
    });

    if (decision === "ENABLED") {
      if (inMonth.length === 0) {
        await tx.expense.createMany({
          data: [
            {
              userId,
              description: template.description,
              amount: template.amount,
              currency: template.currency,
              categoryId: template.categoryId,
              notes: template.notes,
              medium: template.medium,
              originCurrency: template.originCurrency,
              originAmount: template.originAmount,
              date: isoDateToDate(dateInMonth(month, template.dayOfMonth)),
              // Created ahead of time: it still has to be paid.
              status: "PLANNED" as const,
              isRecurring: true,
              recurringExpenseId: id,
            },
          ],
          skipDuplicates: true,
        });
      }
    } else {
      const settled =
        inMonth.find((row) => row.status === "SETTLED") ??
        inMonth.find((row) => row.status === "COVERED");

      if (settled) {
        throw new RecurringExpenseSettledError(
          template.description,
          settled.status as "SETTLED" | "COVERED",
        );
      }

      if (inMonth.length > 0) {
        await tx.expense.deleteMany({
          where: {
            id: { in: inMonth.map((row) => row.id) },
            userId,
            status: "PLANNED",
          },
        });
      }
    }

    await tx.recurringExpenseDecision.upsert({
      where: { recurringExpenseId_month: { recurringExpenseId: id, month } },
      create: { recurringExpenseId: id, month, decision },
      update: { decision },
    });
  });
};
