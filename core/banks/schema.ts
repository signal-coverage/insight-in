import { z } from "zod";

import { requiredText } from "@/core/entries/fields";

import {
  BANK_KIND_REQUIRED_MESSAGE,
  BANK_KINDS,
  BANK_NAME_MAX_LENGTH,
} from "./consts";

// Trimmed, non-empty, at most 40 characters, and a kind the app knows (required on every submit, so a
// request that omits it never turns a wallet into an entity). Fields it does not know (an owner, an
// archive date) are dropped, so they can never reach the database through here.
export const bankInputSchema = z.object({
  name: requiredText("El nombre", BANK_NAME_MAX_LENGTH),
  kind: z.enum(BANK_KINDS, { error: BANK_KIND_REQUIRED_MESSAGE }),
});
