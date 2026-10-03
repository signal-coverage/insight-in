"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import { todayIso } from "@/core/incomes/dates";
import { invalidInstallmentCountMessage } from "@/core/installments/consts";
import { InvalidInstallmentCountError } from "@/core/installments/errors";
import { installmentCountsSchema } from "@/core/installments/schema";
import type { InstallmentCountInput } from "@/core/installments/types";
import { monthOf } from "@/core/summary/month";

import {
  EXPENSES_PATH,
  invalidRecurringAmountMessage,
  OVERVIEW_PATH,
  RECURRING_FORM_FIELDS,
  RECURRING_INVALID_MESSAGE,
  RECURRING_NOT_FOUND_MESSAGE,
  recurringExpenseSettledMessage,
} from "./consts";
import {
  InvalidRecurringAmountError,
  RecurringExpenseSettledError,
  RecurringNotFoundError,
} from "./errors";
import {
  recurringDecisionsSchema,
  recurringDecisionValueSchema,
  recurringExpenseInputSchema,
  recurringIdSchema,
} from "./recurringSchema";
import {
  applyRecurringDecisions,
  removeRecurringExpense,
  setRecurringDecision,
  updateRecurringExpense,
} from "./recurringService";
import type {
  ExpenseActionResult,
  ExpenseFieldErrors,
  RecurringDecisionInput,
  RecurringDecisionValue,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("recurring-expenses", run);

// The monthly wizard's "Aplicar": one call carries every row that got a choice and the installment
// counts the user changed. The month is always the current one (Argentine date), never something
// the browser says.
export async function applyRecurringDecisionsAction(
  decisions: RecurringDecisionInput[],
  installmentCounts: InstallmentCountInput[] = [],
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsed = recurringDecisionsSchema.safeParse(decisions);
    const parsedCounts = installmentCountsSchema.safeParse(installmentCounts);

    if (!parsed.success || !parsedCounts.success) {
      return failure(RECURRING_INVALID_MESSAGE);
    }

    try {
      await applyRecurringDecisions(
        userId,
        monthOf(todayIso()),
        parsed.data,
        parsedCounts.data,
      );
    } catch (error) {
      if (error instanceof InvalidRecurringAmountError) {
        return failure(invalidRecurringAmountMessage(error.description));
      }

      if (error instanceof InvalidInstallmentCountError) {
        return failure(invalidInstallmentCountMessage(error.description));
      }

      throw error;
    }

    revalidatePath(EXPENSES_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });
}

const revalidateRecurring = (): void => {
  revalidatePath(EXPENSES_PATH);
  revalidatePath(OVERVIEW_PATH);
};

// Edits one template from the drawer, at any time. It only changes the template: the expenses it
// already created are left as they are.
export async function updateRecurringExpenseAction(
  id: string,
  formData: FormData,
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsedId = recurringIdSchema.safeParse(id);
    const parsed = recurringExpenseInputSchema.safeParse(
      readForm(formData, RECURRING_FORM_FIELDS),
    );

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as ExpenseFieldErrors,
      );
    }

    if (
      !parsedId.success ||
      !(await updateRecurringExpense(userId, parsedId.data, parsed.data))
    ) {
      return failure(RECURRING_NOT_FOUND_MESSAGE);
    }

    revalidateRecurring();

    return { status: "success" };
  });
}

// Changes what was decided for the current month (always the Argentine one, never what the browser
// says): enabling creates the month's pending expense, disabling takes it out while it is still
// pending and refuses once it is paid or covered.
export async function setRecurringDecisionAction(
  id: string,
  decision: RecurringDecisionValue,
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsedId = recurringIdSchema.safeParse(id);
    const parsedDecision = recurringDecisionValueSchema.safeParse(decision);

    if (!parsedId.success || !parsedDecision.success) {
      return failure(RECURRING_INVALID_MESSAGE);
    }

    try {
      await setRecurringDecision(
        userId,
        parsedId.data,
        monthOf(todayIso()),
        parsedDecision.data,
      );
    } catch (error) {
      if (error instanceof RecurringExpenseSettledError) {
        return failure(
          recurringExpenseSettledMessage(error.description, error.status),
        );
      }

      if (error instanceof RecurringNotFoundError) {
        return failure(RECURRING_NOT_FOUND_MESSAGE);
      }

      throw error;
    }

    revalidateRecurring();

    return { status: "success" };
  });
}

// Quitar, at any time: the template goes, the expenses it created stay.
export async function removeRecurringExpenseAction(
  id: string,
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsedId = recurringIdSchema.safeParse(id);

    if (!parsedId.success) {
      return failure(RECURRING_INVALID_MESSAGE);
    }

    if (!(await removeRecurringExpense(userId, parsedId.data))) {
      return failure(RECURRING_NOT_FOUND_MESSAGE);
    }

    revalidateRecurring();

    return { status: "success" };
  });
}
