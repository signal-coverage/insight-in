"use server";

import { revalidatePath } from "next/cache";

import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import { BANKS_PATH } from "@/core/banks/consts";
import {
  failure,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";

import {
  INVALID_OPENING_BALANCE_MESSAGE,
  OPENING_ACCOUNTS_CHANGED_MESSAGE,
  OVERVIEW_PATH,
} from "./consts";
import { openingBalanceInputSchema } from "./schema";
import { saveOpeningBalances } from "./service";
import type { OpeningBalanceActionResult } from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("opening-balance", run);

// "Guardar" in the opening balance editor: one call carries the month and every account's amount.
// Nothing from the payload decides who the owner is.
export async function saveOpeningBalanceAction(
  input: unknown,
): Promise<OpeningBalanceActionResult> {
  return runAuthenticated<OpeningBalanceActionResult>(async (userId) => {
    const parsed = openingBalanceInputSchema.safeParse(input);

    if (!parsed.success) {
      const fieldErrors: Record<string, string[]> = {};

      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");

        fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
      }

      return {
        ...failure(INVALID_OPENING_BALANCE_MESSAGE),
        fieldErrors,
      };
    }

    try {
      await saveOpeningBalances(userId, parsed.data);
    } catch (error) {
      // An account of the editor changed while it was open: the user reopens it with fresh rows.
      if (
        error instanceof AccountNotFoundError ||
        error instanceof AccountCurrencyMismatchError
      ) {
        return failure(OPENING_ACCOUNTS_CHANGED_MESSAGE);
      }

      throw error;
    }

    revalidatePath(OVERVIEW_PATH);
    // The Banks board shows balances that include the opening amounts.
    revalidatePath(BANKS_PATH);

    return { status: "success" };
  });
}
