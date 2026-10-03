import { prisma } from "@/infrastructure/db/client";

import { toPlanProgress } from "./planProgress";
import type { PlanProgress } from "./types";

// How far along the given plans of the user are, with one grouped query for all of them (never one per
// row), and none at all when there are no plans. Scoped by owner.
export const listExpensePlanProgress = async (
  userId: string,
  planIds: readonly string[],
): Promise<Record<string, PlanProgress>> => {
  if (planIds.length === 0) {
    return {};
  }

  const groups = await prisma.expense.groupBy({
    by: ["installmentPlanId", "status"],
    where: { userId, installmentPlanId: { in: [...planIds] } },
    _count: { _all: true },
  });

  return toPlanProgress(groups);
};

// The same, for the loans repaid in installments (income plans).
export const listIncomePlanProgress = async (
  userId: string,
  planIds: readonly string[],
): Promise<Record<string, PlanProgress>> => {
  if (planIds.length === 0) {
    return {};
  }

  const groups = await prisma.income.groupBy({
    by: ["installmentPlanId", "status"],
    where: { userId, installmentPlanId: { in: [...planIds] } },
    _count: { _all: true },
  });

  return toPlanProgress(groups);
};
