import { z } from "zod";

import { currencyField, requiredText } from "@/core/entries/fields";

import { ACCOUNT_NAME_MAX_LENGTH, BANK_REQUIRED_MESSAGE } from "./consts";

// What an account says: the only part of it an edit can change. Fields it does not know (an owner,
// a bank, an archive date) are dropped, so they can never reach the database through here.
export const accountInputSchema = z.object({
  name: requiredText("El nombre", ACCOUNT_NAME_MAX_LENGTH),
  currency: currencyField,
});

// A new account also says which bank it goes to. The service checks that the bank is the user's.
export const createAccountInputSchema = accountInputSchema.extend({
  bankId: z
    .string({ error: BANK_REQUIRED_MESSAGE })
    .trim()
    .min(1, BANK_REQUIRED_MESSAGE),
});
