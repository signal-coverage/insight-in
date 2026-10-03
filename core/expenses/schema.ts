import { z } from "zod";

import {
  amountField,
  categoryIdField,
  checkAmount,
  currencyField,
  dateField,
  descriptionField,
  expenseStatusField,
  mediumField,
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
  checkExpectedReimbursement,
  expectedReimbursementField,
  toExpectedReimbursement,
} from "@/core/reimbursements/fields";

import type { ExpenseInput } from "./types";

// A form can only send text, so the mark arrives as "true" / "false".
const recurringField = z
  .enum(["true", "false"], { error: "Valor no válido." })
  .default("false")
  .transform((value) => value === "true");

// The card is optional: a form that has none (or the "Sin tarjeta" choice) sends nothing or "".
const cardIdField = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

// Validates raw form values (all strings) and outputs the persisted shape, with the amount
// already converted to minor units for the chosen currency.
export const expenseInputSchema = z
  .object({
    description: descriptionField,
    amount: amountField,
    currency: currencyField,
    date: dateField,
    categoryId: categoryIdField,
    notes: notesField,
    status: expenseStatusField,
    medium: mediumField,
    isRecurring: recurringField,
    cardId: cardIdField,
    originCurrency: originCurrencyField,
    originAmount: originAmountField,
    expectedReimbursement: expectedReimbursementField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);
    checkOrigin(value, ctx);
    checkExpectedReimbursement(value, ctx);
  })
  .transform((value): ExpenseInput => ({
    ...value,
    amount: toAmount(value),
    ...toOrigin(value),
    expectedReimbursement: toExpectedReimbursement(value),
  }));
