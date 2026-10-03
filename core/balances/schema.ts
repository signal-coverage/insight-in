import { z } from "zod";

import { currencyField } from "@/core/entries/fields";
import { toMinorUnits } from "@/core/incomes/money";
import { isSupportedMonth } from "@/core/summary/month";

import {
  DUPLICATE_CURRENCY_MESSAGE,
  INVALID_BALANCE_AMOUNT_MESSAGE,
  INVALID_MONTH_MESSAGE,
  MAX_OPENING_CURRENCIES,
} from "./consts";
import type { OpeningAmount } from "./types";

// What the editor sends: one row per currency, the two amounts as typed (text).
const balanceRowSchema = z.object({
  currency: currencyField,
  digital: z.string().trim(),
  cash: z.string().trim(),
});

export interface OpeningBalanceInput {
  month: string;
  amounts: OpeningAmount[];
}

// Validates the editor's payload and outputs the amounts in minor units. An empty field means
// "no amount" and is left out; zero is an amount like any other, but a negative one never is.
export const openingBalanceInputSchema = z
  .object({
    month: z
      .string({ error: INVALID_MONTH_MESSAGE })
      .refine(isSupportedMonth, INVALID_MONTH_MESSAGE),
    balances: z.array(balanceRowSchema).max(MAX_OPENING_CURRENCIES),
  })
  .transform((value, ctx): OpeningBalanceInput => {
    const amounts: OpeningAmount[] = [];
    const seen = new Set<string>();

    value.balances.forEach((row, index) => {
      if (seen.has(row.currency)) {
        ctx.issues.push({
          code: "custom",
          input: row.currency,
          path: ["balances", index, "currency"],
          message: DUPLICATE_CURRENCY_MESSAGE,
        });

        return;
      }

      seen.add(row.currency);

      for (const [field, medium] of [
        ["digital", "DIGITAL"],
        ["cash", "CASH"],
      ] as const) {
        const text = row[field];

        if (text === "") {
          continue;
        }

        const amount = toMinorUnits(text, row.currency);

        if (amount === null) {
          ctx.issues.push({
            code: "custom",
            input: text,
            path: ["balances", index, field],
            message: INVALID_BALANCE_AMOUNT_MESSAGE,
          });
        } else {
          amounts.push({ currency: row.currency, medium, amount });
        }
      }
    });

    return { month: value.month, amounts };
  });
