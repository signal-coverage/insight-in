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
import { BULK_INVALID_MESSAGE, bulkIdsSchema } from "@/core/entries/bulk";
import { formatMoney } from "@/core/incomes/money";

import {
  ACCOUNT_PROBLEM_MESSAGES,
  FUTURE_DATE_MESSAGE,
  giveBackMessage,
  insufficientFundsMessage,
  SAME_ACCOUNT_MESSAGE,
  TRANSFER_FORM_FIELDS,
  TRANSFER_NOT_FOUND_MESSAGE,
  TRANSFER_REVALIDATE_PATHS,
  TRANSFERS_NOT_FOUND_MESSAGE,
} from "./consts";
import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";
import { transferInputSchema } from "./schema";
import {
  createTransfer,
  deleteTransfer,
  deleteTransfers,
  updateTransfer,
} from "./service";
import type {
  TransferActionResult,
  TransferFieldErrors,
  TransferInput,
  TransfersDeleteResult,
} from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("transfers", run);

const SUCCESS: TransferActionResult = { status: "success" };

type ParsedForm = { data: TransferInput } | { error: ActionFailure };

const parseTransferForm = (formData: FormData): ParsedForm => {
  const result = transferInputSchema.safeParse(
    readForm(formData, TRANSFER_FORM_FIELDS),
  );

  if (result.success) {
    return { data: result.data };
  }

  return {
    error: fieldFailure(
      z.flattenError(result.error).fieldErrors as TransferFieldErrors,
    ),
  };
};

// The errors a transfer can run into that the user can act on, each on the field it is about.
// Anything else is unexpected and is left for runAuthenticated to log. `plain` is for the writes that
// have no form (a delete): the refusal then comes as a message, which is what its dialog shows.
const toKnownFailure = (
  error: unknown,
  plain: boolean,
): ActionFailure | undefined => {
  if (error instanceof TransferAccountError) {
    return fieldFailure({
      [error.side === "from" ? "fromAccountId" : "toAccountId"]: [
        ACCOUNT_PROBLEM_MESSAGES[error.problem],
      ],
    });
  }

  if (error instanceof TransferSameAccountError) {
    return fieldFailure({ toAccountId: [SAME_ACCOUNT_MESSAGE] });
  }

  if (error instanceof TransferFutureDateError) {
    return fieldFailure({ date: [FUTURE_DATE_MESSAGE] });
  }

  if (error instanceof TransferInsufficientFundsError) {
    return fieldFailure({
      amount: [
        insufficientFundsMessage(formatMoney(error.available, error.currency)),
      ],
    });
  }

  // An account would have to give back more than it holds (a delete, or an edit that takes money back
  // from the old destination): the message names the account and its balance.
  if (error instanceof TransferGiveBackError) {
    const message = giveBackMessage(
      error.accountLabel,
      formatMoney(error.available, error.currency),
      formatMoney(error.amount, error.currency),
    );

    return plain ? failure(message) : fieldFailure({ amount: [message] });
  }

  return undefined;
};

// Runs a write and answers its value, or the failure a known error turns into; an unknown error is
// rethrown for runAuthenticated to log. The one place a write's errors are caught.
const attempt = async <Value>(
  run: () => Promise<Value>,
  plain: boolean,
): Promise<Value | ActionFailure> => {
  try {
    return await run();
  } catch (error) {
    const known = toKnownFailure(error, plain);

    if (known) {
      return known;
    }

    throw error;
  }
};

// Moving money changes the balances the Banks board and the summary show, so a write refreshes all of
// their pages, and only when it went through.
const revalidateAll = (): void => {
  TRANSFER_REVALIDATE_PATHS.forEach((path) => revalidatePath(path));
};

// Runs a write that answers whether it changed something. `false` is a transfer that is not the user's.
const write = async (
  run: () => Promise<boolean>,
  plain = false,
): Promise<TransferActionResult | ActionFailure> => {
  const changed = await attempt(run, plain);

  if (typeof changed === "object") {
    return changed;
  }

  if (!changed) {
    return failure(TRANSFER_NOT_FOUND_MESSAGE);
  }

  revalidateAll();

  return SUCCESS;
};

export async function createTransferAction(
  formData: FormData,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseTransferForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(async () => {
      await createTransfer(userId, parsed.data);

      return true;
    });
  });
}

export async function updateTransferAction(
  id: string,
  formData: FormData,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    // An id that is not text cannot be a transfer of the user (and an undefined one would drop out of
    // the service's `where` and match every transfer).
    if (typeof id !== "string" || id.length === 0) {
      return failure(TRANSFER_NOT_FOUND_MESSAGE);
    }

    const parsed = parseTransferForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateTransfer(userId, id, parsed.data));
  });
}

export async function deleteTransferAction(
  id: string,
): Promise<TransferActionResult> {
  return runAuthenticated(async (userId) => {
    // An id that is not text cannot be a transfer of the user.
    if (typeof id !== "string" || id.length === 0) {
      return failure(TRANSFER_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteTransfer(userId, id), true);
  });
}

// Deletes the selected transfers of the table in one go. Only the user's own are deleted; the result
// says how many were.
export async function deleteTransfersAction(
  ids: string[],
): Promise<TransfersDeleteResult> {
  return runAuthenticated<TransfersDeleteResult>(async (userId) => {
    const parsed = bulkIdsSchema.safeParse(ids);

    if (!parsed.success) {
      return failure(BULK_INVALID_MESSAGE);
    }

    const deleted = await attempt(
      () => deleteTransfers(userId, parsed.data),
      true,
    );

    if (typeof deleted === "object") {
      return deleted;
    }

    if (deleted === 0) {
      return failure(TRANSFERS_NOT_FOUND_MESSAGE);
    }

    revalidateAll();

    return { status: "success", deleted };
  });
}
