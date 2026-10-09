import { z } from "zod";

import {
  accountIdField,
  amountField,
  categoryIdField,
  categoryIdSchema,
  categoryInputSchema,
  checkAmount,
  currencyField,
  dateField,
  descriptionField,
  notesField,
  statusField,
  toAmount,
} from "@/core/entries/fields";
import {
  checkOrigin,
  originAmountField,
  originCurrencyField,
  toOrigin,
} from "@/core/entries/originFields";
import { reimbursesExpenseIdField } from "@/core/reimbursements/fields";

import { isValidIsoDate } from "./dates";
import type { RecurrenceFrequency } from "./recurrence";
import type { IncomeInput, RecurringIncomeInput } from "./types";

export { categoryIdSchema, categoryInputSchema };

// Validates raw form values (all strings) and outputs the persisted shape, with the
// amount already converted to minor units for the chosen currency.
export const incomeInputSchema = z
  .object({
    description: descriptionField,
    amount: amountField,
    currency: currencyField,
    date: dateField,
    categoryId: categoryIdField,
    notes: notesField,
    status: statusField,
    accountId: accountIdField,
    originCurrency: originCurrencyField,
    originAmount: originAmountField,
    reimbursesExpenseId: reimbursesExpenseIdField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);
    checkOrigin(value, ctx);
  })
  .transform((value): IncomeInput => ({
    ...value,
    amount: toAmount(value),
    ...toOrigin(value),
  }));

const frequencyField = z.enum(["WEEKLY", "MONTHLY", "YEARLY"], {
  error: "Selecciona cada cuánto se repite.",
});

const endDateField = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null)
  .refine(
    (value) => value === null || isValidIsoDate(value),
    "Ingresa una fecha válida.",
  );

export const recurringIncomeInputSchema = z
  .object({
    description: descriptionField,
    amount: amountField,
    currency: currencyField,
    categoryId: categoryIdField,
    notes: notesField,
    accountId: accountIdField,
    frequency: frequencyField,
    startDate: dateField,
    endDate: endDateField,
  })
  .superRefine((value, ctx) => {
    checkAmount(value, ctx);

    if (value.endDate !== null && value.endDate < value.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "La fecha de fin debe ser igual o posterior a la de inicio.",
      });
    }
  })
  .transform((value): RecurringIncomeInput => ({
    ...value,
    frequency: value.frequency satisfies RecurrenceFrequency,
    amount: toAmount(value),
  }));

export const recurringIdSchema = z
  .string({ error: "El ingreso recurrente es obligatorio." })
  .trim()
  .min(1, "El ingreso recurrente es obligatorio.");
