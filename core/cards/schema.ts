import { z } from "zod";

import {
  amountField,
  checkAmount,
  currencyField,
  toAmount,
} from "@/core/entries/fields";

import {
  CARD_BRANDS,
  CARD_LIMIT_MODES,
  MAX_CARD_DAY,
  MIN_CARD_DAY,
} from "./consts";
import type { CardInput } from "./types";

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

// Validates raw form values (all strings) and outputs the persisted shape, with the cap already
// converted to minor units of the chosen currency. The cap is checked by the amount helper every
// entry form uses; it reports on `amount`, so its issues are moved to `limitAmount`.
export const cardInputSchema = z
  .object({
    last4: last4Field,
    brand: brandField,
    closingDay: dayField("El día de cierre"),
    dueDay: dayField("El día de vencimiento"),
    currency: currencyField,
    limitMode: limitModeField,
    limitAmount: amountField,
  })
  .superRefine((value, ctx) =>
    checkAmount(
      { amount: value.limitAmount, currency: value.currency },
      {
        addIssue: (issue) => ctx.addIssue({ ...issue, path: ["limitAmount"] }),
      },
    ),
  )
  .transform((value): CardInput => ({
    ...value,
    limitAmount: toAmount({
      amount: value.limitAmount,
      currency: value.currency,
    }),
  }));
