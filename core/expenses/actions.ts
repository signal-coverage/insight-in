"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ACCOUNT_REQUIRED_MESSAGE } from "@/core/accounts/consts";
import { cardBankWithoutAccountMessage } from "@/core/cards/consts";
import { CardBankWithoutAccountError } from "@/core/cards/errors";
import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";
import { BULK_INVALID_MESSAGE, bulkIdsSchema } from "@/core/entries/bulk";
import { categoryIdSchema, categoryInputSchema } from "@/core/entries/fields";
import { isEntryStatus } from "@/core/entries/status";
import type { EntryStatus } from "@/core/entries/status";
import type { BulkDeleteResult } from "@/core/entries/types";
import {
  CATEGORY_NOT_FOUND_MESSAGE,
  INVALID_FORM_MESSAGE,
  LAST_CATEGORY_MESSAGE,
} from "@/core/incomes/consts";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  LastCategoryError,
} from "@/core/incomes/errors";
import { formatMoney } from "@/core/incomes/money";

import {
  EXPENSE_CHANGED_MESSAGE,
  EXPENSE_FORM_FIELDS,
  EXPENSE_FUTURE_DEBIT_MESSAGE,
  EXPENSE_NOT_FOUND_MESSAGE,
  EXPENSES_NOT_FOUND_MESSAGE,
  EXPENSES_PATH,
  expenseCategoryInUseMessage,
  expenseInsufficientFundsMessage,
} from "./consts";
import {
  ExpenseAccountRequiredError,
  ExpenseChangedError,
  ExpenseFutureDebitError,
  ExpenseInsufficientFundsError,
} from "./errors";
import { expenseInputSchema } from "./schema";
import {
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  deleteExpenses,
  renameCategory,
  setExpenseStatus,
  updateExpense,
} from "./service";
import type {
  ExpenseActionResult,
  ExpenseCategoryActionResult,
  ExpenseFieldErrors,
  ExpenseInput,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("expenses", run);

const SUCCESS: ExpenseActionResult = { status: "success" };

type ParsedForm = { data: ExpenseInput } | { error: ActionFailure };

const parseExpenseForm = (formData: FormData): ParsedForm => {
  const result = expenseInputSchema.safeParse(
    readForm(formData, EXPENSE_FORM_FIELDS),
  );

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: fieldFailure(
      z.flattenError(result.error).fieldErrors as ExpenseFieldErrors,
    ),
  };
};

const finish = (changed: boolean): ExpenseActionResult => {
  if (!changed) {
    return failure(EXPENSE_NOT_FOUND_MESSAGE);
  }

  revalidatePath(EXPENSES_PATH);

  return SUCCESS;
};

// The refusals of a write that involves a debit card's money or a credit card's account, on the field
// they are about, or as a plain message for the status checkbox (`plain`), which has no fields.
// Anything else is left for runAuthenticated.
const toExpenseFailure = (
  error: unknown,
  plain: boolean,
): ActionFailure | undefined => {
  if (error instanceof ExpenseInsufficientFundsError) {
    const message = expenseInsufficientFundsMessage(
      formatMoney(error.available, error.currency),
    );

    return plain ? failure(message) : fieldFailure({ amount: [message] });
  }

  if (error instanceof CardBankWithoutAccountError) {
    const message = cardBankWithoutAccountMessage(error.currency);

    return plain ? failure(message) : fieldFailure({ cardId: [message] });
  }

  if (error instanceof ExpenseFutureDebitError) {
    return plain
      ? failure(EXPENSE_FUTURE_DEBIT_MESSAGE)
      : fieldFailure({ date: [EXPENSE_FUTURE_DEBIT_MESSAGE] });
  }

  // Not about any field: the form shows it as its general error, the checkbox as its message.
  if (error instanceof ExpenseChangedError) {
    return failure(EXPENSE_CHANGED_MESSAGE);
  }

  if (error instanceof ExpenseAccountRequiredError) {
    return fieldFailure({ accountId: [ACCOUNT_REQUIRED_MESSAGE] });
  }

  return undefined;
};

const attempt = async (
  run: () => Promise<ExpenseActionResult>,
  plain: boolean,
): Promise<ExpenseActionResult> => {
  try {
    return await run();
  } catch (error) {
    const known = toExpenseFailure(error, plain);

    if (known) {
      return known;
    }

    throw error;
  }
};

// An id that is not text cannot be an expense of the user (and undefined would vanish from a where).
const isUsableId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0;

export async function createExpenseAction(
  formData: FormData,
): Promise<ExpenseActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseExpenseForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return attempt(async () => {
      await createExpense(userId, parsed.data);

      return finish(true);
    }, false);
  });
}

export async function updateExpenseAction(
  id: string,
  formData: FormData,
): Promise<ExpenseActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(EXPENSE_NOT_FOUND_MESSAGE);
    }

    const parsed = parseExpenseForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return attempt(
      async () => finish(await updateExpense(userId, id, parsed.data)),
      false,
    );
  });
}

// The checkbox in the table: flips one expense between planned and paid.
export async function setExpenseStatusAction(
  id: string,
  status: EntryStatus,
): Promise<ExpenseActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(EXPENSE_NOT_FOUND_MESSAGE);
    }

    if (!isEntryStatus(status)) {
      return failure(INVALID_FORM_MESSAGE);
    }

    return attempt(
      async () => finish(await setExpenseStatus(userId, id, status)),
      true,
    );
  });
}

export async function deleteExpenseAction(
  id: string,
): Promise<ExpenseActionResult> {
  return runAuthenticated(async (userId) => {
    if (!isUsableId(id)) {
      return failure(EXPENSE_NOT_FOUND_MESSAGE);
    }

    return finish(await deleteExpense(userId, id));
  });
}

// Deletes the selected expenses of the table in one go. Only the user's own are deleted; the result
// says how many were.
export async function deleteExpensesAction(
  ids: string[],
): Promise<BulkDeleteResult> {
  return runAuthenticated<BulkDeleteResult>(async (userId) => {
    const parsed = bulkIdsSchema.safeParse(ids);

    if (!parsed.success) {
      return failure(BULK_INVALID_MESSAGE);
    }

    const deleted = await deleteExpenses(userId, parsed.data);

    if (deleted === 0) {
      return failure(EXPENSES_NOT_FOUND_MESSAGE);
    }

    revalidatePath(EXPENSES_PATH);

    return { status: "success", deleted };
  });
}

// Takes the bare name (not FormData): the inline "add category" row lives inside the expense
// form, so it cannot be a form of its own.
export async function createCategoryAction(
  name: string,
): Promise<ExpenseCategoryActionResult> {
  return runAuthenticated<ExpenseCategoryActionResult>(async (userId) => {
    const parsed = categoryInputSchema.safeParse({ name });

    if (!parsed.success) {
      return fieldFailure(
        z.flattenError(parsed.error).fieldErrors as ExpenseFieldErrors,
      );
    }

    const category = await createCategory(userId, parsed.data.name);

    revalidatePath(EXPENSES_PATH);

    return { status: "success", category };
  });
}

// Rename and delete act on a category picked from a list, so a missing one is a plain message
// rather than a form field error.
const toCategoryManagementFailure = (
  error: unknown,
): ActionFailure | undefined => {
  if (error instanceof CategoryNotFoundError) {
    return failure(CATEGORY_NOT_FOUND_MESSAGE);
  }

  if (error instanceof CategoryInUseError) {
    return failure(
      expenseCategoryInUseMessage(
        error.count,
        error.recurringCount,
        error.installmentCount,
      ),
    );
  }

  if (error instanceof LastCategoryError) {
    return failure(LAST_CATEGORY_MESSAGE);
  }

  return undefined;
};

export async function renameCategoryAction(
  id: string,
  name: string,
): Promise<ExpenseCategoryActionResult> {
  return runAuthenticated<ExpenseCategoryActionResult>(async (userId) => {
    const parsedId = categoryIdSchema.safeParse(id);
    const parsedName = categoryInputSchema.safeParse({ name });

    if (!parsedName.success) {
      return fieldFailure(
        z.flattenError(parsedName.error).fieldErrors as ExpenseFieldErrors,
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

      revalidatePath(EXPENSES_PATH);

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
): Promise<ExpenseActionResult> {
  return runAuthenticated<ExpenseActionResult>(async (userId) => {
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

    revalidatePath(EXPENSES_PATH);

    return SUCCESS;
  });
}
