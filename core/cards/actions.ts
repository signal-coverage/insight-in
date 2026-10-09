"use server";

import { revalidatePath } from "next/cache";
import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";
import {
  failure,
  fieldFailure,
  readForm,
  runAuthenticated as runScoped,
} from "@/core/entries/actionHelpers";
import type { ActionFailure } from "@/core/entries/actionHelpers";
import { BULK_INVALID_MESSAGE, bulkIdsSchema } from "@/core/entries/bulk";

import {
  CARD_BANK_ARCHIVED_MESSAGE,
  CARD_BANK_LOCKED_MESSAGE,
  CARD_BANK_NOT_FOUND_MESSAGE,
  CARD_FORM_FIELDS,
  CARD_HAS_PENDING_MESSAGE,
  CARD_KIND_LOCKED_MESSAGE,
  CARD_NOT_FOUND_MESSAGE,
  CARDS_NOT_FOUND_MESSAGE,
  CARDS_PATH,
  duplicateCardMessage,
} from "./consts";
import {
  CardBankLockedError,
  CardHasPendingExpensesError,
  CardKindLockedError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import { readLimitRows } from "./formLimits";
import { parseCardInput } from "./schema";
import { createCard, deleteCard, deleteCards, updateCard } from "./service";
import type { CardActionResult, CardInput, CardsDeleteResult } from "./types";

// The owner always comes from the Clerk session; see runAuthenticated in the helpers.
const runAuthenticated = <Result extends { status: string }>(
  run: (userId: string) => Promise<Result>,
) => runScoped("cards", run);

const SUCCESS: CardActionResult = { status: "success" };

type ParsedForm = { data: CardInput } | { error: ActionFailure };

// The single-value fields plus the caps, which travel as repeated pairs.
const parseCardForm = (formData: FormData): ParsedForm => {
  const result = parseCardInput({
    ...readForm(formData, CARD_FORM_FIELDS),
    limits: readLimitRows(formData),
  });

  return result.success
    ? { data: result.data }
    : { error: fieldFailure(result.fieldErrors) };
};

// The errors a card can run into that the user can act on. Anything else is unexpected and is left
// for runAuthenticated to log.
const toKnownFailure = (error: unknown): ActionFailure | undefined => {
  if (error instanceof DuplicateCardError) {
    return fieldFailure({
      last4: [duplicateCardMessage(error.brand, error.last4)],
    });
  }

  if (error instanceof CardNotFoundError) {
    return failure(CARD_NOT_FOUND_MESSAGE);
  }

  if (error instanceof CardHasPendingExpensesError) {
    return failure(CARD_HAS_PENDING_MESSAGE);
  }

  if (error instanceof CardKindLockedError) {
    return fieldFailure({ kind: [CARD_KIND_LOCKED_MESSAGE] });
  }

  if (error instanceof CardBankLockedError) {
    return fieldFailure({ bankId: [CARD_BANK_LOCKED_MESSAGE] });
  }

  if (error instanceof BankNotFoundError) {
    return fieldFailure({ bankId: [CARD_BANK_NOT_FOUND_MESSAGE] });
  }

  if (error instanceof BankArchivedError) {
    return fieldFailure({ bankId: [CARD_BANK_ARCHIVED_MESSAGE] });
  }

  return undefined;
};

// Runs a write and turns the known failures into the result the form shows; revalidates the page
// only when the write went through.
const write = async (
  run: () => Promise<void>,
): Promise<CardActionResult | ActionFailure> => {
  try {
    await run();
  } catch (error) {
    const known = toKnownFailure(error);

    if (known) {
      return known;
    }

    throw error;
  }

  revalidatePath(CARDS_PATH);

  return SUCCESS;
};

export async function createCardAction(
  formData: FormData,
): Promise<CardActionResult> {
  return runAuthenticated(async (userId) => {
    const parsed = parseCardForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(async () => {
      await createCard(userId, parsed.data);
    });
  });
}

export async function updateCardAction(
  id: string,
  formData: FormData,
): Promise<CardActionResult> {
  return runAuthenticated(async (userId) => {
    // An id that is not text cannot be a card of the user (and undefined would vanish from a where).
    if (typeof id !== "string" || id.length === 0) {
      return failure(CARD_NOT_FOUND_MESSAGE);
    }

    const parsed = parseCardForm(formData);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateCard(userId, id, parsed.data));
  });
}

export async function deleteCardAction(id: string): Promise<CardActionResult> {
  return runAuthenticated(async (userId) => {
    // An id that is not text cannot be a card of the user.
    if (typeof id !== "string" || id.length === 0) {
      return failure(CARD_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteCard(userId, id));
  });
}

// Deletes the selected cards of the table in one go. A card with an expense still pending is left
// out (see deleteCard), and the result says how many were and how many were not.
export async function deleteCardsAction(
  ids: string[],
): Promise<CardsDeleteResult> {
  return runAuthenticated<CardsDeleteResult>(async (userId) => {
    const parsed = bulkIdsSchema.safeParse(ids);

    if (!parsed.success) {
      return failure(BULK_INVALID_MESSAGE);
    }

    const { deleted, skipped } = await deleteCards(userId, parsed.data);

    if (deleted === 0 && skipped === 0) {
      return failure(CARDS_NOT_FOUND_MESSAGE);
    }

    // Nothing changed when every card was left out, so there is nothing to refresh.
    if (deleted > 0) {
      revalidatePath(CARDS_PATH);
    }

    return { status: "success", deleted, skipped };
  });
}
