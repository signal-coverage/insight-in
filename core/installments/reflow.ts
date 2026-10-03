import { dateInMonth } from "@/core/expenses/recurrence";
import { monthOf, shiftMonth } from "@/core/summary/month";

import { InvalidInstallmentCountError } from "./errors";
import type {
  DateMove,
  InstallmentCountInput,
  InstallmentRow,
  PlanForReflow,
} from "./types";

// Pure logic of the monthly wizard's installments. An installment is "pending" while it is still
// PLANNED; a paid (SETTLED) or covered (COVERED) one is done and never moves.

const pendingOf = (installments: readonly InstallmentRow[]): InstallmentRow[] =>
  installments
    .filter(({ status }) => status === "PLANNED")
    .sort((a, b) => a.number - b.number);

// How many installments are still to pay: the most a month can take.
export const pendingCount = (installments: readonly InstallmentRow[]): number =>
  pendingOf(installments).length;

// The pending installments already dated in the month: what the wizard offers by default.
export const countInMonth = (
  installments: readonly InstallmentRow[],
  month: string,
): number =>
  pendingOf(installments).filter(({ date }) => monthOf(date) === month).length;

// Re-lays out the pending installments of a plan so that exactly `count` of them fall in `month`
// (the first ones, by installment number, on the plan's day) and the rest follow one per month
// from the next one on. With 0 the whole plan is pushed back from next month. Only the dates that
// actually change are returned, so a layout that is already right writes nothing. Null when the
// count is not a whole number between 0 and the pending installments.
export const reflowPlan = ({
  installments,
  dayOfMonth,
  month,
  count,
}: {
  installments: readonly InstallmentRow[];
  dayOfMonth: number;
  month: string;
  count: number;
}): DateMove[] | null => {
  const pending = pendingOf(installments);

  if (!Number.isInteger(count) || count < 0 || count > pending.length) {
    return null;
  }

  return pending.flatMap((installment, index): DateMove[] => {
    const target = index < count ? month : shiftMonth(month, index - count + 1);
    const date = dateInMonth(target, dayOfMonth);

    return date === installment.date ? [] : [{ id: installment.id, date }];
  });
};

// Turns the counts the user chose into the date changes to write. Anything that is not one of the
// user's plans (the caller only passes those) and any repeat of a plan is ignored, which is what
// makes applying the same counts twice harmless. Throws for a count the plan cannot take.
export const planCounts = ({
  plans,
  requested,
  month,
}: {
  plans: readonly PlanForReflow[];
  requested: readonly InstallmentCountInput[];
  month: string;
}): DateMove[] => {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const seen = new Set<string>();
  const moves: DateMove[] = [];

  for (const { planId, count } of requested) {
    const plan = byId.get(planId);

    if (!plan || seen.has(plan.id)) {
      continue;
    }

    seen.add(plan.id);

    const planMoves = reflowPlan({
      installments: plan.installments,
      dayOfMonth: plan.dayOfMonth,
      month,
      count,
    });

    if (planMoves === null) {
      throw new InvalidInstallmentCountError(plan.description);
    }

    moves.push(...planMoves);
  }

  return moves;
};
