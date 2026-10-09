"use server";

import {
  isUsableId,
  parseForm,
  runAuthenticated,
  write,
} from "@/core/banks/actionHelpers";
import type { BanksActionResult } from "@/core/banks/types";
import { CARDS_PATH } from "@/core/cards/consts";
import { failure } from "@/core/entries/actionHelpers";

import {
  ACCOUNT_NOT_FOUND_MESSAGE,
  CREATE_ACCOUNT_FORM_FIELDS,
  UPDATE_ACCOUNT_FORM_FIELDS,
} from "./consts";
import { accountInputSchema, createAccountInputSchema } from "./schema";
import {
  archiveAccount,
  createAccount,
  deleteAccount,
  unarchiveAccount,
  updateAccount,
} from "./service";

export async function createAccountAction(
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated("accounts", async (userId) => {
    const parsed = parseForm(
      createAccountInputSchema,
      formData,
      CREATE_ACCOUNT_FORM_FIELDS,
    );

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => createAccount(userId, parsed.data));
  });
}

export async function updateAccountAction(
  id: string,
  formData: FormData,
): Promise<BanksActionResult> {
  return runAuthenticated("accounts", async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    // An edit reads only the name and the currency: the bank an account belongs to never changes.
    const parsed = parseForm(
      accountInputSchema,
      formData,
      UPDATE_ACCOUNT_FORM_FIELDS,
    );

    if ("error" in parsed) {
      return parsed.error;
    }

    return write(() => updateAccount(userId, id, parsed.data));
  });
}

export async function archiveAccountAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated("accounts", async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    return write(() => archiveAccount(userId, id));
  });
}

// Brings the account back. The service refuses while its bank is archived.
export async function unarchiveAccountAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated("accounts", async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    return write(() => unarchiveAccount(userId, id));
  });
}

// Deletes the account for good. The service refuses when anything points at it (archive it instead);
// the id is checked here because a missing one would be dropped from a Prisma where.
export async function deleteAccountAction(
  id: string,
): Promise<BanksActionResult> {
  return runAuthenticated("accounts", async (userId) => {
    if (!isUsableId(id)) {
      return failure(ACCOUNT_NOT_FOUND_MESSAGE);
    }

    return write(() => deleteAccount(userId, id), [CARDS_PATH]);
  });
}
