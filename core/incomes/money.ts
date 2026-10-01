import { dinero, toDecimal } from "dinero.js";
import type { Dinero, DineroCurrency } from "dinero.js";

import {
  DISPLAY_LOCALE,
  MAX_MINOR_UNITS,
  SUPPORTED_CURRENCIES,
} from "./consts";

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

const CURRENCIES_BY_CODE = new Map<string, DineroCurrency<number>>(
  SUPPORTED_CURRENCIES.map((currency) => [currency.code, currency]),
);

const requireCurrency = (code: string): DineroCurrency<number> => {
  const currency = CURRENCIES_BY_CODE.get(code);

  if (!currency) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  return currency;
};

// BigInt -> number happens only here, at the persistence boundary. Dinero works with
// plain numbers, so anything beyond the safe integer range is rejected instead of being
// silently rounded.
export const minorUnitsToNumber = (value: bigint): number => {
  if (value > MAX_MINOR_UNITS || value < -MAX_MINOR_UNITS) {
    throw new RangeError("Amount is outside the safe integer range");
  }

  return Number(value);
};

const toDinero = (
  minorUnits: number | bigint,
  currencyCode: string,
): Dinero<number> =>
  dinero({
    amount:
      typeof minorUnits === "bigint"
        ? minorUnitsToNumber(minorUnits)
        : minorUnits,
    currency: requireCurrency(currencyCode),
  });

// Parses a plain decimal string ("1234.56") into minor units for the given currency.
// Returns null for malformed input, more fraction digits than the currency allows, an
// unsupported currency or a value beyond the safe integer range.
export const toMinorUnits = (
  input: string,
  currencyCode: string,
): number | null => {
  const currency = CURRENCIES_BY_CODE.get(currencyCode);
  const match = DECIMAL_PATTERN.exec(input.trim());

  if (!currency || !match) {
    return null;
  }

  const [, whole, fraction = ""] = match;

  if (fraction.length > currency.exponent) {
    return null;
  }

  const minorUnits = BigInt(whole + fraction.padEnd(currency.exponent, "0"));

  return minorUnits > MAX_MINOR_UNITS ? null : Number(minorUnits);
};

// Plain decimal representation ("1234.56"), suitable for prefilling an input.
export const toDecimalString = (
  minorUnits: number | bigint,
  currencyCode: string,
): string => toDecimal(toDinero(minorUnits, currencyCode));

export const formatMoney = (
  minorUnits: number | bigint,
  currencyCode: string,
  locale: string = DISPLAY_LOCALE,
): string =>
  new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(toDecimalString(minorUnits, currencyCode) as `${number}`);
