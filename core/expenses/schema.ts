import { z } from "zod";

import {
  amountField,
  categoryIdField,
  checkAmount,
  currencyField,
  dateField,
  descriptionField,
  notesField,
  statusField,
  toAmount,
} from "@/core/entries/fields";

import type { ExpenseInput } from "./types";

// A form can only send text, so the mark arrives as "true" / "false".
const recurringField = z
  .enum(["true", "false"], { error: "Valor no válido." })
  .default("false")
  .transform((value) => value === "true");

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
    status: statusField,
    isRecurring: recurringField,
  })
  .superRefine(checkAmount)
  .transform((value): ExpenseInput => ({ ...value, amount: toAmount(value) }));
