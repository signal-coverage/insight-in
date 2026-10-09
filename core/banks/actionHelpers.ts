import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  ACCOUNT_CURRENCY_LOCKED_MESSAGE,
  ACCOUNT_HAS_MOVEMENTS_MESSAGE,
  ACCOUNT_NOT_FOUND_MESSAGE,
  DUPLICATE_ACCOUNT_MESSAGE,
  ENTITY_LEGAL_TENDER_ONLY_MESSAGE,
  accountHasBalanceMessage,
  accountInUseMessage,
} from "@/core/accounts/consts";
import {
  AccountCurrencyLockedError,
  AccountHasBalanceError,
  AccountHasMovementsError,
  AccountInUseError,
  AccountNotFoundError,
  CryptoCurrencyNotAllowedError,
  DuplicateAccountError,
} from "@/core/accounts/errors";
import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";
import { OVERVIEW_PATH } from "@/core/balances/consts";
import { formatMoney } from "@/core/incomes/money";
import { TRANSFERS_PATH } from "@/core/transfers/consts";

import {
  BANK_ARCHIVED_MESSAGE,
  BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE,
  BANK_NOT_FOUND_MESSAGE,
  BANKS_PATH,
  DUPLICATE_BANK_MESSAGE,
  bankHasAccountsMessage,
  bankHasActiveAccountsMessage,
  bankHasCardsMessage,
} from "./consts";
import {
  BankArchivedError,
  BankHasAccountsError,
  BankHasActiveAccountsError,
  BankHasCardsError,
  BankHasCryptoAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import type { BanksActionResult, BanksFieldErrors, ParsedForm } from "./types";

// Plumbing shared by the server actions of banks and of accounts. It is not a "use server" module:
// nothing here is callable from the browser.

// The owner always comes from the Clerk session; see runAuthenticated in the entries helpers.
// `scope` tags the log line of an unexpected failure ("banks" or "accounts").
export const runAuthenticated = <Result extends { status: string }>(
  scope: "banks" | "accounts",
  run: (userId: string) => Promise<Result>,
) => runScoped(scope, run);

export const SUCCESS: BanksActionResult = { status: "success" };

export const toFieldFailure = (error: z.ZodError): ActionFailure =>
  fieldFailure(z.flattenError(error).fieldErrors as BanksFieldErrors);

// Reads the listed fields of a form, validates them, and returns the data or the field failure the
// UI shows. Fields that are not listed never reach the schema.
export const parseForm = <T>(
  schema: z.ZodType<T>,
  formData: FormData,
  fields: readonly string[],
): ParsedForm<T> => {
  const result = schema.safeParse(readForm(formData, fields));

  return result.success
    ? { data: result.data }
    : { error: toFieldFailure(result.error) };
};

// The errors a bank or an account can run into that the user can act on. Anything else is
// unexpected and is left for runAuthenticated to log.
export const toKnownFailure = (error: unknown): ActionFailure | undefined => {
  if (error instanceof DuplicateBankError) {
    return fieldFailure({ name: [DUPLICATE_BANK_MESSAGE] });
  }

  if (error instanceof DuplicateAccountError) {
    return fieldFailure({ name: [DUPLICATE_ACCOUNT_MESSAGE] });
  }

  if (error instanceof BankNotFoundError) {
    return failure(BANK_NOT_FOUND_MESSAGE);
  }

  if (error instanceof AccountNotFoundError) {
    return failure(ACCOUNT_NOT_FOUND_MESSAGE);
  }

  if (error instanceof BankArchivedError) {
    return failure(BANK_ARCHIVED_MESSAGE);
  }

  if (error instanceof BankHasActiveAccountsError) {
    return failure(bankHasActiveAccountsMessage(error.count));
  }

  if (error instanceof BankHasAccountsError) {
    return failure(bankHasAccountsMessage(error.count));
  }

  if (error instanceof BankHasCardsError) {
    return failure(bankHasCardsMessage(error.count));
  }

  if (error instanceof AccountHasMovementsError) {
    return failure(ACCOUNT_HAS_MOVEMENTS_MESSAGE);
  }

  if (error instanceof AccountCurrencyLockedError) {
    return fieldFailure({ currency: [ACCOUNT_CURRENCY_LOCKED_MESSAGE] });
  }

  if (error instanceof CryptoCurrencyNotAllowedError) {
    return fieldFailure({ currency: [ENTITY_LEGAL_TENDER_ONLY_MESSAGE] });
  }

  if (error instanceof BankHasCryptoAccountsError) {
    return fieldFailure({ kind: [BANK_HAS_CRYPTO_ACCOUNTS_MESSAGE] });
  }

  if (error instanceof AccountHasBalanceError) {
    return failure(
      accountHasBalanceMessage(formatMoney(error.balance, error.currency)),
    );
  }

  if (error instanceof AccountInUseError) {
    return failure(accountInUseMessage(error.pending, error.templates));
  }

  return undefined;
};

// Runs a write and turns the known failures into the result the UI shows; revalidates the page
// only when the write went through. `alsoRevalidate` adds pages that show what the write removed.
export const write = async (
  run: () => Promise<unknown>,
  alsoRevalidate: readonly string[] = [],
): Promise<BanksActionResult | ActionFailure> => {
  try {
    await run();
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    throw error;
  }

  // Account names and archived state also appear in the transfers and the overview.
  revalidatePath(BANKS_PATH);
  revalidatePath(TRANSFERS_PATH);
  revalidatePath(OVERVIEW_PATH);
  alsoRevalidate.forEach((path) => revalidatePath(path));

  return SUCCESS;
};

// An id that is not text cannot be a record of the user.
export const isUsableId = (id: unknown): id is string =>
  typeof id === "string" && id.length > 0;
