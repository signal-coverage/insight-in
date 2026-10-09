"use server";

import { CARDS_PATH } from "@/core/cards/consts";
import { failure } from "@/core/entries/actionHelpers";

import {
  isUsableId,
  parseForm,
  runAuthenticated,
  write,
} from "./actionHelpers";
import { BANK_FORM_FIELDS, BANK_NOT_FOUND_MESSAGE } from "./consts";
import { bankInputSchema } from "./schema";
import {
  archiveBank,
  createBank,
  deleteBank,
  unarchiveBank,
  updateBank,
} from "./service";
import type { BanksActionResult } from "./types";

export async function createBankAction(
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated("banks", async (userId) => {
    const parsed = parseForm(bankInputSchema, formData, BANK_FORM_FIELDS);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => createBank(userId, parsed.data));
  });
}

export async function updateBankAction(
  id: string,
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated("banks", async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    const parsed = parseForm(bankInputSchema, formData, BANK_FORM_FIELDS);

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateBank(userId, id, parsed.data));
  });
}

// Archives the bank. The service refuses while any of its accounts is still active.
export async function archiveBankAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated("banks", async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    return write(() => archiveBank(userId, id));
  });
}

export async function unarchiveBankAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated("banks", async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    return write(() => unarchiveBank(userId, id));
  });
}

// Deletes the bank for good. The service refuses while it still has accounts (archived ones included)
// or cards; the id is checked here because a missing one would be dropped from a Prisma where.
export async function deleteBankAction(id: string): Promise<BanksActionResult> {
  return runAuthenticated("banks", async (userId) => {
    if (!isUsableId(id)) {
      return failure(BANK_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteBank(userId, id), [CARDS_PATH]);
  });
}
