import { z } from "zod";

import {
  amountField,
  checkAmount,
  currencyField,
  dateField,
  notesField,
  toAmount,
} from "@/core/entries/fields";
import { isValidIsoDate } from "@/core/incomes/dates";
import { isSupportedMonth, monthOf } from "@/core/summary/month";

import {
  DATE_RANGE_MESSAGE,
  FROM_ACCOUNT_REQUIRED_MESSAGE,
  SAME_ACCOUNT_MESSAGE,
  TO_ACCOUNT_REQUIRED_MESSAGE,
} from "./consts";
import type { TransferInput } from "./types";

const accountField = (message: string) =>
  z.string({ error: message }).trim().min(1, message);

// Validates raw form values (all strings) and outputs the persisted shape, with the amount already
// converted to minor units for the chosen currency. The service checks what only the database can
// tell: that both accounts are the user's, active and in that currency, the date against today, and
// the funds.
export const transferInputSchema = z
  .object({
    currency: currencyField,
    fromAccountId: accountField(FROM_ACCOUNT_REQUIRED_MESSAGE),
    toAccountId: accountField(TO_ACCOUNT_REQUIRED_MESSAGE),
    amount: amountField,
    date: dateField,
    notes: notesField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);

    if (
      value.fromAccountId !== "" &&
      value.fromAccountId === value.toAccountId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["toAccountId"],
        message: SAME_ACCOUNT_MESSAGE,
      });
    }

    // The month filter only reaches 2000 to 2099, so a transfer outside them could never be found.
    if (isValidIsoDate(value.date) && !isSupportedMonth(monthOf(value.date))) {
      ctx.addIssue({
        code: "custom",
        path: ["date"],
        message: DATE_RANGE_MESSAGE,
      });
    }
  })
  .transform((value): TransferInput => ({
    ...value,
    amount: toAmount(value),
  }));
