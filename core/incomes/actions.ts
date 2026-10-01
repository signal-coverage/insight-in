"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";
import { isEntryStatus } from "@/core/entries/status";
import type { EntryStatus } from "@/core/entries/status";

import {
  CATEGORY_NOT_FOUND_MESSAGE,
  categoryInUseMessage,
  INCOME_FORM_FIELDS,
  INCOMES_PATH,
  INVALID_FORM_MESSAGE,
  LAST_CATEGORY_MESSAGE,
  NOT_FOUND_MESSAGE,
  RECURRING_FORM_FIELDS,
  RECURRING_NOT_FOUND_MESSAGE,
} from "./consts";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  LastCategoryError,
} from "./errors";

import {
  categoryIdSchema,
  categoryInputSchema,
  incomeInputSchema,
  recurringIdSchema,
  recurringIncomeInputSchema,
} from "./schema";
import {
  createCategory,
  createIncome,
  createRecurringIncome,
  deleteCategory,
  deleteIncome,
  deleteRecurringIncome,
  renameCategory,
  setIncomeStatus,
  updateIncome,
  updateRecurringIncome,
} from "./service";
import type {
  CategoryActionResult,
  IncomeActionResult,
  IncomeFieldErrors,
  IncomeInput,
  RecurringIncomeInput,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("incomes", run);

const SUCCESS: IncomeActionResult = { status: "success" };

type ParsedForm = { data: IncomeInput } | { error: ActionFailure };

const parseIncomeForm = (formData: FormData): ParsedForm => {
  const result = incomeInputSchema.safeParse(
    readForm(formData, INCOME_FORM_FIELDS),
  );

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: fieldFailure(
      z.flattenError(result.error).fieldErrors as IncomeFieldErrors,
    ),
  };
};

const finish = (changed: boolean): IncomeActionResult => {
  if (!changed) {
    return failure(NOT_FOUND_MESSAGE);
  }

  revalidatePath(INCOMES_PATH);

  return SUCCESS;
};

export async function createIncomeAction(
  formData: FormData,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseIncomeForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    await createIncome(userId, parsed.data);

    return finish(true);
  });
}

export async function updateIncomeAction(
  id: string,
  formData: FormData,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseIncomeForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return finish(await updateIncome(userId, id, parsed.data));
  });
}

// The checkbox in the table: flips one income between planned and collected.
export async function setIncomeStatusAction(
  id: string,
  status: EntryStatus,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isEntryStatus(status)) {
      return failure(INVALID_FORM_MESSAGE);
    }

    return finish(await setIncomeStatus(userId, id, status));
  });
}

export async function deleteIncomeAction(
  id: string,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) =>
    finish(await deleteIncome(userId, id)),
  );
}

// Takes the bare name (not FormData): the inline "add category" row lives inside the
// income form, so it cannot be a form of its own.
export async function createCategoryAction(
  name: string,
): Promise<CategoryActionResult> {
  return runAuthenticated<CategoryActionResult>(async (userId) => {
    const parsed = categoryInputSchema.safeParse({ name });

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as IncomeFieldErrors,
      );
    }

    const category = await createCategory(userId, parsed.data.name);

    revalidatePath(INCOMES_PATH);

    return { status: "success", category };
  });
}

// Rename and delete act on a category picked from a list, so a missing one is a plain
// message rather than a form field error.
const toCategoryManagementFailure = (
  error: unknown,
): ActionFailure | undefined => {
  if (error instanceof CategoryNotFoundError) {
    return failure(CATEGORY_NOT_FOUND_MESSAGE);
  }

  if (error instanceof CategoryInUseError) {
    return failure(categoryInUseMessage(error.count, error.recurringCount));
  }

  if (error instanceof LastCategoryError) {
    return failure(LAST_CATEGORY_MESSAGE);
  }

  return undefined;
};

export async function renameCategoryAction(
  id: string,
  name: string,
): Promise<CategoryActionResult> {
  return runAuthenticated<CategoryActionResult>(async (userId) => {
    const parsedId = categoryIdSchema.safeParse(id);
    const parsedName = categoryInputSchema.safeParse({ name });

    if (!parsedName.success) {
      return fieldFailure(
        z.flattenError(parsedName.error).fieldErrors as IncomeFieldErrors,
      );
    }

    if (!parsedId.success) {
      return failure(CATEGORY_NOT_FOUND_MESSAGE);
    }

    try {
      const category = await renameCategory(
        userId,
        parsedId.data,
        parsedName.data.name,
      );

      revalidatePath(INCOMES_PATH);

      return { status: "success", category };
    } catch (error) {
      const known = toCategoryManagementFailure(error);

      if (known) {
        return known;
      }

      throw error;
    }
  });
}

export async function deleteCategoryAction(
  id: string,
): Promise<IncomeActionResult> {
  return runAuthenticated<IncomeActionResult>(async (userId) => {
    const parsedId = categoryIdSchema.safeParse(id);

    if (!parsedId.success) {
      return failure(CATEGORY_NOT_FOUND_MESSAGE);
    }

    try {
      await deleteCategory(userId, parsedId.data);
    } catch (error) {
      const known = toCategoryManagementFailure(error);

      if (known) {
        return known;
      }

      throw error;
    }

    revalidatePath(INCOMES_PATH);

    return SUCCESS;
  });
}

type ParsedRecurringForm =
  { data: RecurringIncomeInput } | { error: ActionFailure };

const parseRecurringForm = (formData: FormData): ParsedRecurringForm => {
  const result = recurringIncomeInputSchema.safeParse(
    readForm(formData, RECURRING_FORM_FIELDS),
  );

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: fieldFailure(
      z.flattenError(result.error).fieldErrors as IncomeFieldErrors,
    ),
  };
};

export async function createRecurringIncomeAction(
  formData: FormData,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseRecurringForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    await createRecurringIncome(userId, parsed.data);
    revalidatePath(INCOMES_PATH);

    return SUCCESS;
  });
}

export async function updateRecurringIncomeAction(
  id: string,
  formData: FormData,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    const parsedId = recurringIdSchema.safeParse(id);

    if (!parsedId.success) {
      return failure(RECURRING_NOT_FOUND_MESSAGE);
    }

    const parsed = parseRecurringForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    if (!(await updateRecurringIncome(userId, parsedId.data, parsed.data))) {
      return failure(RECURRING_NOT_FOUND_MESSAGE);
    }

    revalidatePath(INCOMES_PATH);

    return SUCCESS;
  });
}

export async function deleteRecurringIncomeAction(
  id: string,
): Promise<IncomeActionResult> {
  return runAuthenticated(async (userId) => {
    const parsedId = recurringIdSchema.safeParse(id);

    if (
      !parsedId.success ||
      !(await deleteRecurringIncome(userId, parsedId.data))
    ) {
      return failure(RECURRING_NOT_FOUND_MESSAGE);
    }

    revalidatePath(INCOMES_PATH);

    return SUCCESS;
  });
}
