import { z } from "zod";

import { currencyField } from "@/core/entries/fields";
import { todayIso } from "@/core/incomes/dates";
import { toMinorUnits } from "@/core/incomes/money";
import { isSupportedMonth, monthOf } from "@/core/summary/month";

import {
  ACCOUNT_ROW_REQUIRED_MESSAGE,
  FUTURE_MONTH_MESSAGE,
  INVALID_BALANCE_AMOUNT_MESSAGE,
  INVALID_MONTH_MESSAGE,
  MAX_OPENING_ACCOUNTS,
  REPEATED_ACCOUNT_MESSAGE,
} from "./consts";
import type { OpeningAmount } from "./types";

// What the editor sends: one row per account, with the account's currency (which the service
// checks against the account) and the amount as typed (text).
const balanceRowSchema = z.object({
  accountId: z
    .string({ error: ACCOUNT_ROW_REQUIRED_MESSAGE })
    .trim()
    .min(1, ACCOUNT_ROW_REQUIRED_MESSAGE),
  currency: currencyField,
  amount: z.string().trim(),
});

export interface OpeningBalanceInput {
  month: string;
  amounts: OpeningAmount[];
}

// Validates the editor's payload and outputs the amounts in minor units. An empty amount means "no
// amount" and is left out; zero is an amount like any other, but a negative one never is. The
// opening month cannot be later than the current one (Argentine date): opening amounts only count
// once their month has started, so a future month would show them on the Banks board but not in the
// summary.
export const openingBalanceInputSchema = z
  .object({
    month: z
      .string({ error: INVALID_MONTH_MESSAGE })
      .refine(isSupportedMonth, { error: INVALID_MONTH_MESSAGE, abort: true })
      .refine((month) => month <= monthOf(todayIso()), FUTURE_MONTH_MESSAGE),
    balances: z.array(balanceRowSchema).max(MAX_OPENING_ACCOUNTS),
  })
  .transform((value, ctx): OpeningBalanceInput => {
    const amounts: OpeningAmount[] = [];
    const seen = new Set<string>();

    value.balances.forEach((row, index) => {
      if (seen.has(row.accountId)) {
        ctx.issues.push({
          code: "custom",
          input: row.accountId,
          path: ["balances", index, "accountId"],
          message: REPEATED_ACCOUNT_MESSAGE,
        });

        return;
      }

      seen.add(row.accountId);

      if (row.amount === "") {
        return;
      }

      const amount = toMinorUnits(row.amount, row.currency);

      if (amount === null) {
        ctx.issues.push({
          code: "custom",
          input: row.amount,
          path: ["balances", index, "amount"],
          message: INVALID_BALANCE_AMOUNT_MESSAGE,
        });
      } else {
        amounts.push({
          accountId: row.accountId,
          currency: row.currency,
          amount,
        });
      }
    });

    return { month: value.month, amounts };
  });
