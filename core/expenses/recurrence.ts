import { toMinorUnits } from "@/core/incomes/money";

import { InvalidRecurringAmountError } from "./errors";
import type {
  RecurringDecisionInput,
  RecurringExpenseItem,
  RecurringPlan,
} from "./types";

// Pure logic of the monthly recurring-expenses wizard. Everything works on "YYYY-MM-DD" and
// "YYYY-MM" strings and on UTC, so results never depend on the machine's time zone.

// The day a template repeats on: the day of the date the expense was saved with.
export const dayOfMonthOf = (isoDate: string): number =>
  Number(isoDate.slice(8, 10));

const pad = (value: number): string => String(value).padStart(2, "0");

// The date a template falls on in a month. A month too short for the day uses its last day, so
// the 31st becomes the 30th, or the 28th or 29th of February.
export const dateInMonth = (month: string, dayOfMonth: number): string => {
  const year = Number(month.slice(0, 4));
  const monthNumber = Number(month.slice(5, 7));
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return `${month}-${pad(Math.min(dayOfMonth, lastDay))}`;
};

const byDayThenDescription = (
  a: RecurringExpenseItem,
  b: RecurringExpenseItem,
): number =>
  a.dayOfMonth - b.dayOfMonth || a.description.localeCompare(b.description);

// The templates still waiting for a decision this month, and the ones already decided, each in the
// order the month unfolds.
export const splitByDecision = (
  items: readonly RecurringExpenseItem[],
): { pending: RecurringExpenseItem[]; decided: RecurringExpenseItem[] } => {
  const sorted = [...items].sort(byDayThenDescription);

  return {
    pending: sorted.filter((item) => item.decision === null),
    decided: sorted.filter((item) => item.decision !== null),
  };
};

export const countPending = (items: readonly RecurringExpenseItem[]): number =>
  items.filter((item) => item.decision === null).length;

// Turns what the user chose into what has to be written. Anything that is not one of the user's
// templates (the caller only passes those), anything already decided for the month and any repeat
// of a template is ignored, which is what makes applying the same choices twice harmless. An
// amount only matters when enabling, and then it must be valid in the template's currency.
export const planDecisions = ({
  templates,
  requested,
  month,
}: {
  templates: readonly RecurringExpenseItem[];
  requested: readonly RecurringDecisionInput[];
  month: string;
}): RecurringPlan => {
  const byId = new Map(templates.map((template) => [template.id, template]));
  const seen = new Set<string>();
  const plan: RecurringPlan = { enable: [], disable: [], remove: [] };

  for (const { recurringExpenseId, choice, amount } of requested) {
    const template = byId.get(recurringExpenseId);

    if (!template || template.decision !== null || seen.has(template.id)) {
      continue;
    }

    seen.add(template.id);

    if (choice === "disable") {
      plan.disable.push(template.id);
    } else if (choice === "remove") {
      plan.remove.push(template.id);
    } else {
      const minorUnits =
        amount === undefined
          ? template.amount
          : toMinorUnits(amount, template.currency);

      if (minorUnits === null || minorUnits <= 0) {
        throw new InvalidRecurringAmountError(template.description);
      }

      plan.enable.push({
        templateId: template.id,
        date: dateInMonth(month, template.dayOfMonth),
        amount: minorUnits,
      });
    }
  }

  return plan;
};
