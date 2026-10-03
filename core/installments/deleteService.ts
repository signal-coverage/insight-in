import { prisma } from "@/infrastructure/db/client";

import { InstallmentPlanNotFoundError } from "./errors";

// Deletes a whole plan in installments: every one of its entries (the purchase installments or the
// repayments, paid or not) and then the plan itself, in one transaction, so it all goes or nothing
// does. The database only detaches the entries of a deleted plan (ON DELETE SET NULL), so they are
// deleted explicitly, before the plan. An income that was linked to a deleted expense as its
// reimbursement just loses the link (also ON DELETE SET NULL). A plan has expenses or incomes
// depending on its kind, so both are cleared and the other side simply deletes nothing. Everything is
// scoped by owner. Returns how many entries were removed; throws InstallmentPlanNotFoundError, with
// nothing deleted, when the plan is not the user's.
export const deleteInstallmentPlan = async (
  userId: string,
  planId: string,
): Promise<number> =>
  prisma.$transaction(async (tx) => {
    const plan = await tx.installmentPlan.findFirst({
      where: { id: planId, userId },
      select: { id: true },
    });

    if (!plan) {
      throw new InstallmentPlanNotFoundError();
    }

    const where = { installmentPlanId: planId, userId };
    const expenses = await tx.expense.deleteMany({ where });
    const incomes = await tx.income.deleteMany({ where });

    await tx.installmentPlan.deleteMany({ where: { id: planId, userId } });

    return expenses.count + incomes.count;
  });
