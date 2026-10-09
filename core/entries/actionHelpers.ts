import { auth } from "@clerk/nextjs/server";

import {
  ACCOUNT_ARCHIVED_MESSAGE,
  ACCOUNT_CHOICE_NOT_FOUND_MESSAGE,
  ACCOUNT_CURRENCY_MISMATCH_MESSAGE,
} from "@/core/accounts/consts";
import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import {
  CARD_CURRENCY_MISMATCH_MESSAGE,
  CARD_KIND_NOT_ALLOWED_MESSAGE,
  CARD_NOT_FOUND_MESSAGE,
} from "@/core/cards/consts";
import {
  CardCurrencyMismatchError,
  CardKindNotAllowedError,
  CardNotFoundError,
} from "@/core/cards/errors";
import {
  COVERED_NOT_ALLOWED_MESSAGE,
  INSTALLMENT_CURRENCY_LOCKED_MESSAGE,
  DUPLICATE_CATEGORY_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  INVALID_CATEGORY_MESSAGE,
  INVALID_FORM_MESSAGE,
  NOT_SIGNED_IN_MESSAGE,
} from "@/core/incomes/consts";
import {
  CategoryNotFoundError,
  DuplicateCategoryError,
} from "@/core/incomes/errors";
import {
  EXPENSE_CURRENCY_LOCKED_MESSAGE,
  REIMBURSED_EXPENSE_NOT_FOUND_MESSAGE,
  REIMBURSEMENT_CURRENCY_MISMATCH_MESSAGE,
  REIMBURSEMENT_LOCKED_MESSAGE,
  REIMBURSEMENT_NOT_EXPECTED_MESSAGE,
} from "@/core/reimbursements/consts";
import {
  ExpenseCurrencyLockedError,
  ReimbursedExpenseNotFoundError,
  ReimbursementCurrencyMismatchError,
  ReimbursementLockedError,
  ReimbursementNotExpectedError,
} from "@/core/reimbursements/errors";

import {
  CoveredNotAllowedError,
  InstallmentCurrencyLockedError,
} from "./errors";

// Plumbing shared by the incomes and expenses server actions. It is not a "use server" module:
// nothing here is callable from the browser.

export type FieldErrors = Record<string, string[]>;

export interface ActionFailure {
  status: "error";
  message: string;
  fieldErrors?: FieldErrors;
}

export const failure = (message: string): ActionFailure => ({
  status: "error",
  message,
});

export const fieldFailure = (fieldErrors: FieldErrors): ActionFailure => ({
  status: "error",
  message: INVALID_FORM_MESSAGE,
  fieldErrors,
});

export const readForm = (
  formData: FormData,
  fields: readonly string[],
): Record<string, string | undefined> =>
  Object.fromEntries(
    fields.map((field) => {
      const value = formData.get(field);

      return [field, typeof value === "string" ? value : undefined];
    }),
  );

// Turns the errors the UI can act on into field errors; anything else is unexpected.
const toKnownFailure = (error: unknown): ActionFailure | undefined => {
  if (error instanceof CategoryNotFoundError) {
    return fieldFailure({ categoryId: [INVALID_CATEGORY_MESSAGE] });
  }

  if (error instanceof DuplicateCategoryError) {
    return fieldFailure({ name: [DUPLICATE_CATEGORY_MESSAGE] });
  }

  if (error instanceof CoveredNotAllowedError) {
    return fieldFailure({ status: [COVERED_NOT_ALLOWED_MESSAGE] });
  }

  // The card of an expense or a purchase in installments: a card that is not the user's or that is in
  // another currency than the purchase.
  if (error instanceof CardNotFoundError) {
    return fieldFailure({ cardId: [CARD_NOT_FOUND_MESSAGE] });
  }

  if (error instanceof CardCurrencyMismatchError) {
    return fieldFailure({ cardId: [CARD_CURRENCY_MISMATCH_MESSAGE] });
  }

  if (error instanceof CardKindNotAllowedError) {
    return fieldFailure({ cardId: [CARD_KIND_NOT_ALLOWED_MESSAGE] });
  }

  // The account of an entry, template or plan: one that is not the user's, archived, or in another
  // currency than the movement.
  if (error instanceof AccountNotFoundError) {
    return fieldFailure({ accountId: [ACCOUNT_CHOICE_NOT_FOUND_MESSAGE] });
  }

  if (error instanceof AccountArchivedError) {
    return fieldFailure({ accountId: [ACCOUNT_ARCHIVED_MESSAGE] });
  }

  if (error instanceof AccountCurrencyMismatchError) {
    return fieldFailure({ accountId: [ACCOUNT_CURRENCY_MISMATCH_MESSAGE] });
  }

  // The expense an income pays back: one that is not the user's, that expects nothing or that is in
  // another currency.
  if (error instanceof ReimbursedExpenseNotFoundError) {
    return fieldFailure({
      reimbursesExpenseId: [REIMBURSED_EXPENSE_NOT_FOUND_MESSAGE],
    });
  }

  if (error instanceof ReimbursementNotExpectedError) {
    return fieldFailure({
      reimbursesExpenseId: [REIMBURSEMENT_NOT_EXPECTED_MESSAGE],
    });
  }

  if (error instanceof ReimbursementCurrencyMismatchError) {
    return fieldFailure({
      reimbursesExpenseId: [REIMBURSEMENT_CURRENCY_MISMATCH_MESSAGE],
    });
  }

  // An expense with incomes linked to it keeps its currency and its expected reimbursement.
  if (error instanceof ExpenseCurrencyLockedError) {
    return fieldFailure({ currency: [EXPENSE_CURRENCY_LOCKED_MESSAGE] });
  }

  if (error instanceof InstallmentCurrencyLockedError) {
    return fieldFailure({ currency: [INSTALLMENT_CURRENCY_LOCKED_MESSAGE] });
  }

  if (error instanceof ReimbursementLockedError) {
    return fieldFailure({
      expectedReimbursement: [REIMBURSEMENT_LOCKED_MESSAGE],
    });
  }

  return undefined;
};

// The owner always comes from the Clerk session, never from client input. `scope` only tags the
// log line of an unexpected failure.
export const runAuthenticated = async <Result extends { status: string }>(
  scope: string,
  run: (userId: string) => Promise<Result>,
): Promise<Result | ActionFailure> => {
  const { userId } = await auth();

  if (!userId) {
    return failure(NOT_SIGNED_IN_MESSAGE);
  }

  try {
    return await run(userId);
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    console.error(`[${scope}] action failed`, error);

    return failure(GENERIC_ERROR_MESSAGE);
  }
};
