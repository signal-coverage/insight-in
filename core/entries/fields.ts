import { z } from "zod";

import {
  CATEGORY_NAME_MAX_LENGTH,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
  SUPPORTED_CURRENCY_CODES,
} from "@/core/incomes/consts";
import { isValidIsoDate } from "@/core/incomes/dates";
import { toMinorUnits } from "@/core/incomes/money";

import { DEFAULT_PAYMENT_MEDIUM, PAYMENT_MEDIUMS } from "./medium";
import { DEFAULT_ENTRY_STATUS, ENTRY_STATUSES, MONEY_STATUSES } from "./status";

// Field definitions shared by incomes and expenses (and their recurring templates).
const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);

export const requiredText = (label: string, maxLength: number) =>
  z
    .string({ error: `${label} es obligatorio.` })
    .trim()
    .min(1, `${label} es obligatorio.`)
    .max(maxLength, `${label} admite como máximo ${maxLength} caracteres.`);

export const descriptionField = requiredText(
  "La descripción",
  DESCRIPTION_MAX_LENGTH,
);

export const amountField = z.string({ error: "El monto es obligatorio." });

export const currencyField = z
  .string({ error: "La moneda es obligatoria." })
  .refine(
    (code) => SUPPORTED_CURRENCY_SET.has(code),
    "Selecciona una moneda compatible.",
  );

export const categoryIdField = z
  .string({ error: "La categoría es obligatoria." })
  .trim()
  .min(1, "La categoría es obligatoria.");

export const notesField = z
  .string()
  .trim()
  .max(
    NOTES_MAX_LENGTH,
    `Las notas admiten como máximo ${NOTES_MAX_LENGTH} caracteres.`,
  )
  .nullish()
  .transform((value) => value || null);

export const dateField = z
  .string({ error: "La fecha es obligatoria." })
  .refine(isValidIsoDate, "Ingresa una fecha válida.");

// Incomes: COVERED is not an option, since nothing else ever pays an income.
export const statusField = z
  .enum(MONEY_STATUSES, { error: "Selecciona un estado válido." })
  .default(DEFAULT_ENTRY_STATUS);

// Expenses may also arrive as COVERED: someone else paid it and it never moves the user's money.
export const expenseStatusField = z
  .enum(ENTRY_STATUSES, { error: "Selecciona un estado válido." })
  .default(DEFAULT_ENTRY_STATUS);

export const mediumField = z
  .enum(PAYMENT_MEDIUMS, { error: "Selecciona un medio válido." })
  .default(DEFAULT_PAYMENT_MEDIUM);

export type IssueContext = {
  addIssue: (issue: {
    code: "custom";
    path: string[];
    message: string;
  }) => void;
};

// The amount depends on the currency (its number of decimals), so it is checked after the
// fields. An unsupported currency is already reported on its own field.
export const checkAmount = (
  value: { amount: string; currency: string },
  ctx: IssueContext,
): void => {
  if (!SUPPORTED_CURRENCY_SET.has(value.currency)) {
    return;
  }

  const minorUnits = toMinorUnits(value.amount, value.currency);

  if (minorUnits === null) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message:
        "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    });
  } else if (minorUnits <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message: "El monto debe ser mayor que cero.",
    });
  }
};

// Safe after checkAmount has rejected anything toMinorUnits cannot parse.
export const toAmount = (value: { amount: string; currency: string }): number =>
  toMinorUnits(value.amount, value.currency) as number;

export const categoryInputSchema = z.object({
  name: requiredText("El nombre", CATEGORY_NAME_MAX_LENGTH),
});

export const categoryIdSchema = categoryIdField;
