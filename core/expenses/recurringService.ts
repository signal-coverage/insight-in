import { isoDateToDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { prisma } from "@/infrastructure/db/client";
import type {
  RecurringExpense as TemplateRow,
  RecurringExpenseDecision as DecisionRow,
} from "@/lib/generated/prisma/client";

import { planDecisions } from "./recurrence";
import type {
  RecurringDecisionInput,
  RecurringDecisionValue,
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

// Applies what the user chose in the monthly wizard, all or nothing:
// - enable: creates the month's expense from the template (pending to pay) and records it;
// - disable: only records it, so the template shows up again next month;
// - remove: deletes the template for good. The expenses it already created stay as ordinary rows
//   (the foreign key sets their link to null; their flag is cleared first, while the link is
//   still there to find them by).
// Ids that are not the user's, templates already decided for the month and repeated ids are
// ignored (see planDecisions), and the writes skip duplicates, so submitting twice, even at the
// same time, creates nothing twice. Throws InvalidRecurringAmountError before writing anything.
export const applyRecurringDecisions = async (
  userId: string,
  month: string,
  requested: readonly RecurringDecisionInput[],
): Promise<void> => {
  const templates = await listRecurringExpenses(userId, month);
  const plan = planDecisions({ templates, requested, month });

  if (
    plan.enable.length === 0 &&
    plan.disable.length === 0 &&
    plan.remove.length === 0
  ) {
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

    if (plan.remove.length > 0) {
      await tx.expense.updateMany({
        where: { userId, recurringExpenseId: { in: plan.remove } },
        data: { isRecurring: false },
      });
      await tx.recurringExpense.deleteMany({
        where: { id: { in: plan.remove }, userId },
      });
    }
  });
};
