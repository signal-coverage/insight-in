import { dinero, toDecimal } from "dinero.js";
import type { Dinero, DineroCurrency } from "dinero.js";

import {
  CRYPTO_CURRENCIES,
  CRYPTO_MIN_FRACTION_DIGITS,
} from "@/core/currencies/consts";
import { isCryptoCode } from "@/core/currencies/crypto";

import {
  DISPLAY_LOCALE,
  LEGAL_TENDER_CURRENCIES,
  MAX_MINOR_UNITS,
} from "./consts";

// The one module that knows both kinds of currency: the legal tender of dinero.js and the crypto
// assets of core/currencies. Amounts are minor units (10^-exponent of the currency) as JS numbers. A
// crypto code is never handed to Intl as a currency: Intl rejects "USDC" and formats any three letters
// ("BTC") as if they were ISO, so crypto is written as a plain number followed by its code.

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

// A crypto asset as Dinero sees a currency: base 10 and the registry's exponent, so the same
// conversions serve both kinds.
const CRYPTO_DINERO_CURRENCIES: readonly DineroCurrency<number>[] =
  CRYPTO_CURRENCIES.map(({ code, exponent }) => ({ code, base: 10, exponent }));

const CURRENCIES_BY_CODE = new Map<string, DineroCurrency<number>>(
  [...LEGAL_TENDER_CURRENCIES, ...CRYPTO_DINERO_CURRENCIES].map((currency) => [
    currency.code,
    currency,
  ]),
);

const LEGAL_TENDER_CODES = new Set(
  LEGAL_TENDER_CURRENCIES.map(({ code }) => code),
);

const requireCurrency = (code: string): DineroCurrency<number> => {
  const currency = CURRENCIES_BY_CODE.get(code);

  if (!currency) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  return currency;
};

// An ISO currency the app supports (what an entity bank, a credit card cap or a plan can be in).
export const isLegalTenderCode = (code: string): boolean =>
  LEGAL_TENDER_CODES.has(code);

// Legal tender or a crypto asset of the registry: any currency an account can hold.
export const isSupportedCurrencyCode = (code: string): boolean =>
  CURRENCIES_BY_CODE.has(code);

// How many decimals the currency's minor unit has (2 for USD, 0 for JPY, 6 for every crypto asset),
// or null when the app does not support it.
export const currencyExponent = (code: string): number | null =>
  CURRENCIES_BY_CODE.get(code)?.exponent ?? null;

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

// "1000.5" as an exact decimal string for a number of minor units, with at least `minimum` and at
// most `exponent` decimals (trailing zeros past the minimum are dropped). A negative amount keeps its
// sign in front.
export const toTrimmedDecimal = (
  minorUnits: number | bigint,
  exponent: number,
  minimum: number,
): string => {
  const value = BigInt(minorUnits);
  const isNegative = value < BigInt(0);
  const absolute = isNegative ? -value : value;
  const scale = BigInt(10) ** BigInt(exponent);
  const whole = (absolute / scale).toString();
  const fraction = (absolute % scale)
    .toString()
    .padStart(exponent, "0")
    .replace(/0+$/, "")
    .padEnd(minimum, "0");

  return `${isNegative ? "-" : ""}${fraction ? `${whole}.${fraction}` : whole}`;
};

// Plain decimal representation ("1234.56"), suitable for prefilling an input. A crypto amount keeps
// at least 2 decimals and at most 6 ("1250.50", "0.000001").
export const toDecimalString = (
  minorUnits: number | bigint,
  currencyCode: string,
): string =>
  isCryptoCode(currencyCode)
    ? toTrimmedDecimal(
        minorUnits,
        requireCurrency(currencyCode).exponent,
        CRYPTO_MIN_FRACTION_DIGITS,
      )
    : toDecimal(toDinero(minorUnits, currencyCode));

// A plain decimal string written with the locale's separators ("1.250,5" in es-AR), never as a
// currency.
export const formatDecimal = (
  decimal: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
  locale: string = DISPLAY_LOCALE,
): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(decimal as `${number}`);

// "$ 1.234,56" / "US$ 1.234,56" for legal tender; "1.250,50 USDC" for a crypto asset (at least 2
// decimals, at most the asset's, the code last).
export const formatMoney = (
  minorUnits: number | bigint,
  currencyCode: string,
  locale: string = DISPLAY_LOCALE,
): string => {
  if (isCryptoCode(currencyCode)) {
    const { exponent } = requireCurrency(currencyCode);
    const decimal = toTrimmedDecimal(minorUnits, exponent, 0);

    return `${formatDecimal(decimal, CRYPTO_MIN_FRACTION_DIGITS, exponent, locale)} ${currencyCode}`;
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currencyCode,
  }).format(toDecimalString(minorUnits, currencyCode) as `${number}`);
};
