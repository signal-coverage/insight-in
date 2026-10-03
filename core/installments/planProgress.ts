import type { PlanProgress } from "./types";

// A group of entries of one plan with the same status, as `groupBy` returns it.
interface StatusGroup {
  installmentPlanId: string | null;
  status: string;
  _count: { _all: number };
}

// The plans the given rows belong to, each once.
export const distinctPlanIds = (
  rows: readonly { installmentPlanId: string | null }[],
): string[] => [
  ...new Set(
    rows.flatMap(({ installmentPlanId }) =>
      installmentPlanId === null ? [] : [installmentPlanId],
    ),
  ),
];

// Adds the groups up per plan: how many entries each has and how many are no longer planned (paid,
// collected or covered). Entries that belong to no plan are ignored.
export const toPlanProgress = (
  groups: readonly StatusGroup[],
): Record<string, PlanProgress> => {
  const progress: Record<string, PlanProgress> = {};

  for (const { installmentPlanId, status, _count } of groups) {
    if (installmentPlanId === null) {
      continue;
    }

    const current = progress[installmentPlanId] ?? { total: 0, settled: 0 };

    progress[installmentPlanId] = {
      total: current.total + _count._all,
      settled: current.settled + (status === "PLANNED" ? 0 : _count._all),
    };
  }

  return progress;
};
