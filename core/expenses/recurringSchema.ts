import { z } from "zod";

import {
  accountIdField,
  amountField,
  categoryIdField,
  checkAmount,
  currencyField,
  descriptionField,
  notesField,
  toAmount,
} from "@/core/entries/fields";
import {
  checkOrigin,
  originAmountField,
  originCurrencyField,
  toOrigin,
} from "@/core/entries/originFields";

import {
  MAX_DAY_OF_MONTH,
  MAX_RECURRING_DECISIONS,
  MIN_DAY_OF_MONTH,
  RECURRING_CHOICES,
} from "./consts";
import type { RecurringDecisionInput, RecurringExpenseInput } from "./types";

export const recurringIdSchema = z.string().trim().min(1);

// What a row's Habilitar / Deshabilitar button sends.
export const recurringDecisionValueSchema = z.enum(["ENABLED", "DISABLED"]);

// A form can only send text: whole days only, 1 to 31.
const dayOfMonthField = z
  .string({ error: "El día es obligatorio." })
  .trim()
  .refine(
    (value) =>
      /^\d{1,2}$/.test(value) &&
      Number(value) >= MIN_DAY_OF_MONTH &&
      Number(value) <= MAX_DAY_OF_MONTH,
    `Ingresá un día entre ${MIN_DAY_OF_MONTH} y ${MAX_DAY_OF_MONTH}.`,
  )
  .transform(Number);

// Validates the raw values (all strings) of the template form and outputs the persisted shape, with
// the amount already converted to minor units for the chosen currency.
export const recurringExpenseInputSchema = z
  .object({
    description: descriptionField,
    amount: amountField,
    currency: currencyField,
    categoryId: categoryIdField,
    notes: notesField,
    accountId: accountIdField,
    originCurrency: originCurrencyField,
    originAmount: originAmountField,
    dayOfMonth: dayOfMonthField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);
    checkOrigin(value, ctx);
  })
  .transform((value): RecurringExpenseInput => ({
    ...value,
    amount: toAmount(value),
    ...toOrigin(value),
  }));

const decisionSchema = z
  .object({
    recurringExpenseId: z.string().trim().min(1),
    choice: z.enum(RECURRING_CHOICES),
    amount: z.string().trim().optional(),
  })
  // The amount is kept on the template, so it means something when enabling or disabling, and
  // nothing when removing. How it reads depends on the template's currency, which is checked where
  // the template is known.
  .transform(
    ({ recurringExpenseId, choice, amount }): RecurringDecisionInput => {
      if (choice !== "remove" && amount) {
        return { recurringExpenseId, choice, amount };
      }

      return { recurringExpenseId, choice };
    },
  );

// What the wizard sends: the rows that got a choice, nothing for the rest.
export const recurringDecisionsSchema = z
  .array(decisionSchema)
  .max(MAX_RECURRING_DECISIONS);
