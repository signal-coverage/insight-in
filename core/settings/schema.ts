import { z } from "zod";

import { ALL_CURRENCY_CODES } from "@/core/incomes/consts";
import { isSupportedCurrencyCode } from "@/core/incomes/money";

import {
  INVALID_CURRENCIES_MESSAGE,
  INVALID_SETTING_MESSAGE,
  UNSUPPORTED_CURRENCY_MESSAGE,
} from "./consts";

// A strict boolean: the text "false" is not one, and would otherwise be easy to read as truthy.
export const includeExpectedIncomesSchema = z.boolean({
  error: INVALID_SETTING_MESSAGE,
});

// The currencies to hide from the summary tabs: supported codes only (legal tender or crypto),
// trimmed, in capitals and without repeats. A list longer than the currencies the app knows is
// not a real choice.
export const hiddenSummaryCurrenciesSchema = z
  .array(z.string({ error: INVALID_CURRENCIES_MESSAGE }), {
    error: INVALID_CURRENCIES_MESSAGE,
  })
  .max(ALL_CURRENCY_CODES.length, { error: INVALID_CURRENCIES_MESSAGE })
  .transform((codes) => [
    ...new Set(codes.map((code) => code.trim().toUpperCase())),
  ])
  .refine((codes) => codes.every(isSupportedCurrencyCode), {
    error: UNSUPPORTED_CURRENCY_MESSAGE,
  });
