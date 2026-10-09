import { z } from "zod";

import {
  amountField,
  checkAmount,
  legalTenderCurrencyField,
  toAmount,
} from "@/core/entries/fields";

import {
  CARD_BANK_REQUIRED_MESSAGE,
  CARD_BRANDS,
  CARD_KIND_REQUIRED_MESSAGE,
  CARD_KINDS,
  CARD_LIMIT_MODES,
  DEBIT_CREDIT_FIELDS_MESSAGE,
  DUPLICATE_LIMIT_CURRENCY_MESSAGE,
  LIMITS_REQUIRED_MESSAGE,
  MAX_CARD_DAY,
  MIN_CARD_DAY,
} from "./consts";
import type {
  CardFieldErrors,
  CardInput,
  CreditCardInput,
  DebitCardInput,
} from "./types";

const DAY_PATTERN = /^\d{1,2}$/;

const isCardDay = (value: string): boolean =>
  DAY_PATTERN.test(value) &&
  Number(value) >= MIN_CARD_DAY &&
  Number(value) <= MAX_CARD_DAY;

// A form can only send text, so a day arrives as digits and leaves as a number.
const dayField = (label: string) =>
  z
    .string({ error: `${label} es obligatorio.` })
    .trim()
    .refine(
      isCardDay,
      `${label} debe ser un número entero entre ${MIN_CARD_DAY} y ${MAX_CARD_DAY}.`,
    )
    .transform(Number);

const kindField = z.enum(CARD_KINDS, { error: CARD_KIND_REQUIRED_MESSAGE });

const bankIdField = z
  .string({ error: CARD_BANK_REQUIRED_MESSAGE })
  .trim()
  .min(1, CARD_BANK_REQUIRED_MESSAGE);

const last4Field = z
  .string({ error: "Los últimos 4 dígitos son obligatorios." })
  .trim()
  .regex(/^\d{4}$/, "Ingresá exactamente 4 dígitos.");

const brandField = z.enum(CARD_BRANDS, {
  error: "Seleccioná una marca válida.",
});

const limitModeField = z.enum(CARD_LIMIT_MODES, {
  error: "Seleccioná el tipo de tope.",
});

// One cap as the form sends it: a legal-tender currency and the amount typed in it (a credit card
// never has a crypto cap).
const limitRowField = z.object({
  currency: legalTenderCurrencyField,
  amount: amountField,
});

// At least one cap, never two in the same currency, each amount positive in its own currency. The
// amount helper reports on `amount`, so its issues are moved onto the row they are about.
const creditCardSchema = z
  .object({
    kind: z.literal("CREDIT"),
    bankId: bankIdField,
    last4: last4Field,
    brand: brandField,
    closingDay: dayField("El día de cierre"),
    dueDay: dayField("El día de vencimiento"),
    limitMode: limitModeField,
    limits: z.array(limitRowField),
  })
  .superRefine((value, ctx) => {
    if (value.limits.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["limits"],
        message: LIMITS_REQUIRED_MESSAGE,
      });
    }

    const seen = new Set<string>();

    value.limits.forEach((limit, index) => {
      if (seen.has(limit.currency)) {
        ctx.addIssue({
          code: "custom",
          path: ["limits", index, "currency"],
          message: DUPLICATE_LIMIT_CURRENCY_MESSAGE,
        });
      }

      seen.add(limit.currency);
      checkAmount(limit, {
        addIssue: (issue) =>
          ctx.addIssue({ ...issue, path: ["limits", index, "amount"] }),
      });
    });
  })
  .transform((value): CreditCardInput => ({
    ...value,
    limits: value.limits
      .map((limit) => ({ currency: limit.currency, amount: toAmount(limit) }))
      .sort((a, b) => a.currency.localeCompare(b.currency)),
  }));

// A debit or prepaid card has none of the credit fields: a request that sends any is refused.
// (A key missing from the object is as good as undefined, hence the optional.)
const absentField = z
  .undefined({ error: DEBIT_CREDIT_FIELDS_MESSAGE })
  .optional();

const debitCardSchema = z
  .object({
    kind: z.literal("DEBIT"),
    bankId: bankIdField,
    last4: last4Field,
    brand: brandField,
    closingDay: absentField,
    dueDay: absentField,
    limitMode: absentField,
    limits: z.array(z.unknown()).max(0, DEBIT_CREDIT_FIELDS_MESSAGE),
  })
  .transform(({ kind, bankId, last4, brand }): DebitCardInput => ({
    kind,
    bankId,
    last4,
    brand,
  }));

export type CardParseResult =
  | { success: true; data: CardInput }
  | { success: false; fieldErrors: CardFieldErrors };

// Every issue under the full path of its field: "limits.1.amount" for the amount of the second cap.
export const toCardFieldErrors = (error: z.ZodError): CardFieldErrors => {
  const errors: CardFieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");

    errors[key] = [...(errors[key] ?? []), issue.message];
  }

  return errors;
};

// Validates the raw values of a card form (text, and the caps as rows of text) by kind, and outputs
// the persisted shape: the days as numbers and each cap in minor units of its currency.
export const parseCardInput = (
  values: Record<string, unknown>,
): CardParseResult => {
  const kind = kindField.safeParse(values.kind);

  if (!kind.success) {
    return {
      success: false,
      fieldErrors: { kind: [CARD_KIND_REQUIRED_MESSAGE] },
    };
  }

  const result =
    kind.data === "CREDIT"
      ? creditCardSchema.safeParse(values)
      : debitCardSchema.safeParse(values);

  return result.success
    ? { success: true, data: result.data }
    : { success: false, fieldErrors: toCardFieldErrors(result.error) };
};
