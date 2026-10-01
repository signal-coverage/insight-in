"use server";

import { revalidatePath } from "next/cache";

import {
  failure,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import { todayIso } from "@/core/incomes/dates";
import { monthOf } from "@/core/summary/month";

import {
  EXPENSES_PATH,
  invalidRecurringAmountMessage,
  OVERVIEW_PATH,
  RECURRING_INVALID_MESSAGE,
} from "./consts";
import { InvalidRecurringAmountError } from "./errors";
import { recurringDecisionsSchema } from "./recurringSchema";
import { applyRecurringDecisions } from "./recurringService";
import type { ExpenseActionResult, RecurringDecisionInput } from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("recurring-expenses", run);

// The monthly wizard's "Aplicar": one call carries every row that got a choice. The month is
// always the current one (Argentine date), never something the browser says.
export async function applyRecurringDecisionsAction(
  decisions: RecurringDecisionInput[],
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsed = recurringDecisionsSchema.safeParse(decisions);

    if (!parsed.success) {
      return failure(RECURRING_INVALID_MESSAGE);
    }

    try {
      await applyRecurringDecisions(userId, monthOf(todayIso()), parsed.data);
    } catch (error) {
      if (error instanceof InvalidRecurringAmountError) {
        return failure(invalidRecurringAmountMessage(error.description));
      }

      throw error;
    }

    revalidatePath(EXPENSES_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });
}
