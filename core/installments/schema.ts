import { z } from "zod";

import {
  categoryIdField,
  currencyField,
  mediumField,
  type IssueContext,
  notesField,
  requiredText,
} from "@/core/entries/fields";
import {
  DESCRIPTION_MAX_LENGTH,
  SUPPORTED_CURRENCY_CODES,
} from "@/core/incomes/consts";
import { isValidIsoDate } from "@/core/incomes/dates";
import { isSupportedMonth, monthOf } from "@/core/summary/month";

import { DEFAULT_PAYMENT_MEDIUM } from "@/core/entries/medium";

import {
  AMOUNT_MODES,
  BORROWED_CARD_WITH_ID_MESSAGE,
  CARD_OWNERSHIP_REQUIRED_MESSAGE,
  CARD_OWNERSHIPS,
  INSTALLMENT_SUFFIX_LENGTH,
  LAST_INSTALLMENT_OUT_OF_RANGE_MESSAGE,
  MAX_INSTALLMENT_COUNTS,
  MAX_INSTALLMENTS,
  MIN_INSTALLMENTS,
  OWN_CARD_REQUIRED_MESSAGE,
} from "./consts";
import { lastInstallmentMonth, planTotal } from "./plan";
import type {
  AmountMode,
  IncomeInstallmentPlanInput,
  InstallmentCountInput,
  InstallmentPlanInput,
} from "./types";

const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);

const productField = requiredText(
  "El producto",
  DESCRIPTION_MAX_LENGTH - INSTALLMENT_SUFFIX_LENGTH,
);

const countRange = `entre ${MIN_INSTALLMENTS} y ${MAX_INSTALLMENTS}`;

const totalCuotasField = z
  .number({ error: `Ingresá una cantidad de cuotas ${countRange}.` })
  .int(`Ingresá una cantidad de cuotas ${countRange}.`)
  .min(MIN_INSTALLMENTS, `Ingresá una cantidad de cuotas ${countRange}.`)
  .max(MAX_INSTALLMENTS, `Ingresá una cantidad de cuotas ${countRange}.`);

const firstDateField = z
  .string({ error: "La fecha de la primera cuota es obligatoria." })
  .refine(isValidIsoDate, "Ingresá una fecha válida.")
  .refine(
    (value) => isSupportedMonth(monthOf(value)),
    "Ingresá una fecha entre los años 2000 y 2099.",
  );

// Both come from the planner's own-card choice: no card is nothing or an empty text.
const cardIdField = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

const purchaseDateField = z
  .string()
  .nullish()
  .transform((value) => value || null);

const PURCHASE_DATE_REQUIRED_MESSAGE = "La fecha de la compra es obligatoria.";

interface PlanShape {
  amount: string;
  amountMode: AmountMode;
  currency: string;
  totalCuotas: number;
  firstDate: string;
}

// What every plan, whatever its kind, has to satisfy once its fields are valid on their own: the
// amount makes a positive total in the currency, and the last installment falls in a month the app
// can show.
const checkTotalAndLastMonth = (value: PlanShape, ctx: IssueContext): void => {
  // An unsupported currency is already reported on its own field.
  if (
    SUPPORTED_CURRENCY_SET.has(value.currency) &&
    planTotal(
      value.amount,
      value.amountMode,
      value.totalCuotas,
      value.currency,
    ) === null
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["amount"],
      message:
        "Ingresá un monto válido y mayor que cero, con dígitos y un punto para los decimales.",
    });
  }

  // The last installment must fall in a month the app can show.
  if (
    isValidIsoDate(value.firstDate) &&
    isSupportedMonth(monthOf(value.firstDate)) &&
    !isSupportedMonth(lastInstallmentMonth(value.firstDate, value.totalCuotas))
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["firstDate"],
      message: LAST_INSTALLMENT_OUT_OF_RANGE_MESSAGE,
    });
  }
};

// What the planner sends: plain values, the amount still as typed. The total in minor units is
// worked out here, with the currency's decimals, so the browser never decides the money.
export const installmentPlanSchema = z
  .object({
    description: productField,
    categoryId: categoryIdField,
    currency: currencyField,
    medium: mediumField,
    notes: notesField,
    amount: z.string({ error: "El monto es obligatorio." }),
    amountMode: z.enum(AMOUNT_MODES, {
      error: "Elegí cómo ingresar el monto.",
    }),
    totalCuotas: totalCuotasField,
    firstDate: firstDateField,
    cardOwnership: z.enum(CARD_OWNERSHIPS, {
      error: CARD_OWNERSHIP_REQUIRED_MESSAGE,
    }),
    cardId: cardIdField,
    purchaseDate: purchaseDateField,
  })
  .superRefine((value, ctx) => {
    // A borrowed card has no record, so there is nothing to point at.
    if (value.cardOwnership === "borrowed" && value.cardId) {
      ctx.addIssue({
        code: "custom",
        path: ["cardId"],
        message: BORROWED_CARD_WITH_ID_MESSAGE,
      });
    }

    // A purchase in installments needs a card: with one of the user's own it has to be chosen.
    if (value.cardOwnership === "own" && !value.cardId) {
      ctx.addIssue({
        code: "custom",
        path: ["cardId"],
        message: OWN_CARD_REQUIRED_MESSAGE,
      });
    }

    // The card's billing cycle starts from the day of the purchase, so with an own card it is
    // required and has to be a real day in the years the app can show.
    if (value.cardOwnership === "own" && value.cardId) {
      if (!value.purchaseDate) {
        ctx.addIssue({
          code: "custom",
          path: ["purchaseDate"],
          message: PURCHASE_DATE_REQUIRED_MESSAGE,
        });
      } else if (!isValidIsoDate(value.purchaseDate)) {
        ctx.addIssue({
          code: "custom",
          path: ["purchaseDate"],
          message: "Ingresá una fecha válida.",
        });
      } else if (!isSupportedMonth(monthOf(value.purchaseDate))) {
        ctx.addIssue({
          code: "custom",
          path: ["purchaseDate"],
          message: "Ingresá una fecha entre los años 2000 y 2099.",
        });
      }
    }

    checkTotalAndLastMonth(value, ctx);
  })
  .transform(
    ({
      amount,
      amountMode,
      cardOwnership,
      cardId,
      purchaseDate,
      ...value
    }): InstallmentPlanInput => ({
      ...value,
      // A credit card is always digital money, so an own card forces it whatever came with it. A
      // borrowed card keeps the medium: it is how the user repays the lender.
      medium: cardOwnership === "own" ? DEFAULT_PAYMENT_MEDIUM : value.medium,
      totalAmount: planTotal(
        amount,
        amountMode,
        value.totalCuotas,
        value.currency,
      ) as number,
      // Only an own card has a card and a purchase day to keep.
      ...(cardOwnership === "own" && cardId ? { cardId, purchaseDate } : {}),
    }),
  );

const conceptField = requiredText(
  "El concepto",
  DESCRIPTION_MAX_LENGTH - INSTALLMENT_SUFFIX_LENGTH,
);

// What the repayment planner sends for a loan repaid to the user in installments: the same as a
// purchase without anything about cards (a repayment never has one). Whatever card fields arrive are
// ignored. The category is one of the user's income categories; the service checks it is theirs.
export const incomeInstallmentPlanSchema = z
  .object({
    kind: z.literal("income"),
    description: conceptField,
    categoryId: categoryIdField,
    currency: currencyField,
    medium: mediumField,
    notes: notesField,
    amount: z.string({ error: "El monto es obligatorio." }),
    amountMode: z.enum(AMOUNT_MODES, {
      error: "Elegí cómo ingresar el monto.",
    }),
    totalCuotas: totalCuotasField,
    firstDate: firstDateField,
  })
  .superRefine(checkTotalAndLastMonth)
  .transform((value): IncomeInstallmentPlanInput => ({
    description: value.description,
    categoryId: value.categoryId,
    currency: value.currency,
    medium: value.medium,
    notes: value.notes,
    totalCuotas: value.totalCuotas,
    totalAmount: planTotal(
      value.amount,
      value.amountMode,
      value.totalCuotas,
      value.currency,
    ) as number,
    firstDate: value.firstDate,
  }));

const countEntrySchema = z.object({
  planId: z.string().trim().min(1),
  count: z.number().int().min(0).max(MAX_INSTALLMENTS),
});

// What the wizard sends for the plans whose count the user changed, nothing for the rest.
export const installmentCountsSchema = z
  .array(countEntrySchema)
  .max(MAX_INSTALLMENT_COUNTS)
  .transform((entries): InstallmentCountInput[] =>
    entries.map(({ planId, count }) => ({ planId, count })),
  );

// The id of the plan the delete dialog sends: any non-blank text; whether it is the user's is the
// service's call.
export const installmentPlanIdSchema = z.string().trim().min(1);
