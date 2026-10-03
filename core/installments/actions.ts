"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  failure,
  fieldFailure,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import { EXPENSES_PATH, OVERVIEW_PATH } from "@/core/expenses/consts";
import type {
  ExpenseActionResult,
  ExpenseFieldErrors,
} from "@/core/expenses/types";
import { todayIso } from "@/core/incomes/dates";
import { INCOMES_PATH } from "@/core/incomes/consts";
import { CARDS_PATH } from "@/core/cards/consts";
import type { BulkDeleteResult } from "@/core/entries/types";
import { monthOf } from "@/core/summary/month";

import {
  INSTALLMENT_COUNTS_INVALID_MESSAGE,
  INSTALLMENT_PLAN_NOT_FOUND_MESSAGE,
  invalidInstallmentCountMessage,
  LAST_INSTALLMENT_OUT_OF_RANGE_MESSAGE,
} from "./consts";
import { deleteInstallmentPlan } from "./deleteService";
import {
  InstallmentOutOfRangeError,
  InstallmentPlanNotFoundError,
  InvalidInstallmentCountError,
} from "./errors";
import {
  applyIncomeInstallmentCounts,
  createIncomeInstallmentPlan,
} from "./incomeService";
import {
  incomeInstallmentPlanSchema,
  installmentCountsSchema,
  installmentPlanIdSchema,
  installmentPlanSchema,
} from "./schema";
import { createInstallmentPlan } from "./service";
import type {
  IncomeInstallmentPlanPayload,
  InstallmentCountInput,
  InstallmentPlanPayload,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("installments", run);

const isIncomePayload = (
  payload: unknown,
): payload is IncomeInstallmentPlanPayload =>
  typeof payload === "object" &&
  payload !== null &&
  (payload as { kind?: unknown }).kind === "income";

// The repayment planner's "Guardar devolución": the same, for a loan that is repaid to the user.
const createIncomePlan = (
  payload: IncomeInstallmentPlanPayload,
): Promise<ExpenseActionResult> =>
  runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsed = incomeInstallmentPlanSchema.safeParse(payload);

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as ExpenseFieldErrors,
      );
    }

    await createIncomeInstallmentPlan(userId, parsed.data);

    revalidatePath(INCOMES_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });

// The planner's "Guardar compra" (or, with `kind: "income"`, the repayment planner's "Guardar
// devolución"): creates the plan and all of its installments at once.
export async function createInstallmentPlanAction(
  payload: InstallmentPlanPayload | IncomeInstallmentPlanPayload,
): Promise<ExpenseActionResult> {
  if (isIncomePayload(payload)) {
    return createIncomePlan(payload);
  }

  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsed = installmentPlanSchema.safeParse(payload);

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as ExpenseFieldErrors,
      );
    }

    try {
      await createInstallmentPlan(userId, parsed.data);
    } catch (error) {
      // The card's cycle can push the last installment past the years the app can show; the other
      // known errors (category, card) are mapped by runAuthenticated.
      if (error instanceof InstallmentOutOfRangeError) {
        return fieldFailure({
          purchaseDate: [LAST_INSTALLMENT_OUT_OF_RANGE_MESSAGE],
        });
      }

      throw error;
    }

    revalidatePath(EXPENSES_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });
}

// The "Devoluciones en cuotas" drawer's "Aplicar": how many installments of each loan the user
// collects this month. The month is always the current one (Argentine date), never something the
// browser says.
export async function applyIncomeInstallmentCountsAction(
  counts: InstallmentCountInput[],
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
    const parsed = installmentCountsSchema.safeParse(counts);

    if (!parsed.success) {
      return failure(INSTALLMENT_COUNTS_INVALID_MESSAGE);
    }

    try {
      await applyIncomeInstallmentCounts(
        userId,
        monthOf(todayIso()),
        parsed.data,
      );
    } catch (error) {
      if (error instanceof InvalidInstallmentCountError) {
        return failure(invalidInstallmentCountMessage(error.description));
      }

      throw error;
    }

    revalidatePath(INCOMES_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success" };
  });
}

// The delete dialog's "Eliminar el plan completo": removes the plan and every one of its entries,
// paid or not, and says how many went away. The plan can be of either side (expenses or incomes), so
// every page that shows them is refreshed, and the cards page too, whose usage counts the installments.
export async function deleteInstallmentPlanAction(
  planId: string,
): Promise<BulkDeleteResult> {
  return runAuthenticated<BulkDeleteResult>(async (userId) => {
    const parsed = installmentPlanIdSchema.safeParse(planId);

    if (!parsed.success) {
      return failure(INSTALLMENT_PLAN_NOT_FOUND_MESSAGE);
    }

    let deleted: number;

    try {
      deleted = await deleteInstallmentPlan(userId, parsed.data);
    } catch (error) {
      if (error instanceof InstallmentPlanNotFoundError) {
        return failure(INSTALLMENT_PLAN_NOT_FOUND_MESSAGE);
      }

      throw error;
    }

    revalidatePath(EXPENSES_PATH);
    revalidatePath(INCOMES_PATH);
    revalidatePath(CARDS_PATH);
    revalidatePath(OVERVIEW_PATH);

    return { status: "success", deleted };
  });
}
