import { z } from "zod";

import {
  isOriginCurrencyCode,
  toOriginMinorUnits,
} from "@/core/currencies/origin";
import {
  ORIGIN_AMOUNT_MESSAGE,
  ORIGIN_CURRENCY_MESSAGE,
} from "@/core/incomes/consts";
import { isSupportedCurrencyCode } from "@/core/incomes/money";

import type { IssueContext } from "./fields";

// The origin of an entry (an income's source currency, or the currency an expense was priced in)
// travels as a pair: both fields or none. An empty field (or one that is not sent) is "not filled in".
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

export const originCurrencyField = optionalText;

export const originAmountField = optionalText;

interface OriginFields {
  currency: string;
  originCurrency: string | null;
  originAmount: string | null;
}

// The origin depends on the net currency (it can never be the same) and on its own currency (the
// decimals the amount may have), so it is checked after the fields. An unsupported net currency is
// already reported on its own field.
export const checkOrigin = (value: OriginFields, ctx: IssueContext): void => {
  const { originCurrency, originAmount } = value;

  if (
    (originCurrency === null && originAmount === null) ||
    !isSupportedCurrencyCode(value.currency)
  ) {
    return;
  }

  if (
    originCurrency === null ||
    !isOriginCurrencyCode(originCurrency, value.currency)
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["originCurrency"],
      message: ORIGIN_CURRENCY_MESSAGE,
    });

    // Without a valid currency the amount's precision is unknown, so it is not judged either.
    return;
  }

  const minorUnits =
    originAmount === null
      ? null
      : toOriginMinorUnits(originAmount, originCurrency);

  if (minorUnits === null || minorUnits <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["originAmount"],
      message: ORIGIN_AMOUNT_MESSAGE,
    });
  }
};

// Safe after checkOrigin has rejected anything toOriginMinorUnits cannot parse.
export const toOrigin = (
  value: OriginFields,
): { originCurrency: string | null; originAmount: number | null } =>
  value.originCurrency === null || value.originAmount === null
    ? { originCurrency: null, originAmount: null }
    : {
        originCurrency: value.originCurrency,
        originAmount: toOriginMinorUnits(
          value.originAmount,
          value.originCurrency,
        ) as number,
      };
