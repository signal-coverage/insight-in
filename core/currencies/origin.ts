import {
  DISPLAY_LOCALE,
  MAX_MINOR_UNITS,
  SUPPORTED_CURRENCY_CODES,
} from "@/core/incomes/consts";
import {
  currencyExponent,
  formatMoney,
  toDecimalString,
  toMinorUnits,
} from "@/core/incomes/money";

import {
  CRYPTO_MIN_FRACTION_DIGITS,
  RATE_FRACTION_DIGITS,
  SMALL_RATE_FRACTION_DIGITS,
} from "./consts";
import { cryptoExponent, isCryptoCode } from "./crypto";

// The "origin" of an income: the currency (a crypto asset or any ISO currency) and the amount that
// the net amount that arrived came from. It is only a reference, so these helpers handle both kinds
// of currency behind one interface. A crypto code is never passed to Intl as a currency.

const DECIMAL_PATTERN = /^(\d+)(?:\.(\d+))?$/;

const SUPPORTED_ISO_CODES = new Set(SUPPORTED_CURRENCY_CODES);

export const originExponent = (code: string): number | null =>
  isCryptoCode(code) ? cryptoExponent(code) : currencyExponent(code);

// An origin is a crypto asset or a supported ISO currency, and never the currency of the net amount
// (that would not be an origin at all).
export const isOriginCurrencyCode = (
  code: string,
  netCurrency: string,
): boolean =>
  code !== netCurrency && (isCryptoCode(code) || SUPPORTED_ISO_CODES.has(code));

// Parses a plain decimal string ("1234.56") into minor units of the origin currency. Null for
// malformed input, more decimals than the currency keeps, an unknown code or a value beyond the
// safe integer range.
export const toOriginMinorUnits = (
  input: string,
  code: string,
): number | null => {
  if (!isCryptoCode(code)) {
    return toMinorUnits(input, code);
  }

  const match = DECIMAL_PATTERN.exec(input.trim());

  if (!match) {
    return null;
  }

  const exponent = cryptoExponent(code);
  const [, whole, fraction = ""] = match;

  if (fraction.length > exponent) {
    return null;
  }

  const minorUnits = BigInt(whole + fraction.padEnd(exponent, "0"));

  return minorUnits > MAX_MINOR_UNITS ? null : Number(minorUnits);
};

// "1000.5" as an exact decimal string for a number of minor units, with at least `minimum` and at
// most `exponent` decimals (trailing zeros past the minimum are dropped).
const toTrimmedDecimal = (
  minorUnits: number | bigint,
  exponent: number,
  minimum: number,
): string => {
  const scale = BigInt(10) ** BigInt(exponent);
  const value = BigInt(minorUnits);
  const whole = (value / scale).toString();
  const fraction = (value % scale).toString().padStart(exponent, "0");
  const trimmed = fraction.replace(/0+$/, "").padEnd(minimum, "0");

  return trimmed ? `${whole}.${trimmed}` : whole;
};

// Plain decimal representation, suitable for prefilling an input.
export const toOriginDecimalString = (
  minorUnits: number | bigint,
  code: string,
): string =>
  isCryptoCode(code)
    ? toTrimmedDecimal(
        minorUnits,
        cryptoExponent(code),
        CRYPTO_MIN_FRACTION_DIGITS,
      )
    : toDecimalString(minorUnits, code);

const formatNumber = (
  decimal: string,
  minimumFractionDigits: number,
  maximumFractionDigits: number,
): string =>
  new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(decimal as `${number}`);

// "1.000,50 USDC" for a crypto asset (code last, at least 2 decimals, at most the asset's); an ISO
// currency goes through the regular money formatter ("US$ 1.000,50").
export const formatOrigin = (
  minorUnits: number | bigint,
  code: string,
): string => {
  if (!isCryptoCode(code)) {
    return formatMoney(minorUnits, code);
  }

  const exponent = cryptoExponent(code);
  const decimal = toTrimmedDecimal(minorUnits, exponent, 0);

  return `${formatNumber(decimal, CRYPTO_MIN_FRACTION_DIGITS, exponent)} ${code}`;
};

// The short form used as an accessible name: the code last for any currency, and no decimals for a
// whole amount ("1.000 USDC").
export const formatOriginLabel = (
  minorUnits: number | bigint,
  code: string,
): string => {
  const exponent = originExponent(code);

  if (exponent === null) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  const decimal = toTrimmedDecimal(minorUnits, exponent, 0);
  const isWhole = !decimal.includes(".");
  const minimum = isWhole ? 0 : Math.min(2, exponent);

  return `${formatNumber(decimal, minimum, exponent)} ${code}`;
};

// How many units of the net currency one unit of the origin cost: the net amount over the origin
// amount, each in whole units. Null when either is not positive or a currency is unknown.
export const impliedRate = (
  netMinorUnits: number,
  netCurrency: string,
  originMinorUnits: number,
  originCode: string,
): number | null => {
  const netExponent = currencyExponent(netCurrency);
  const originExp = originExponent(originCode);

  if (
    netExponent === null ||
    originExp === null ||
    netMinorUnits <= 0 ||
    originMinorUnits <= 0
  ) {
    return null;
  }

  return (
    netMinorUnits / 10 ** netExponent / (originMinorUnits / 10 ** originExp)
  );
};

const rateFractionDigits = (rate: number): number =>
  rate < 1 ? SMALL_RATE_FRACTION_DIGITS : RATE_FRACTION_DIGITS;

// "1.200,00"; a rate under 1 keeps 4 decimals so it does not collapse into zero.
export const formatRate = (rate: number): string => {
  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};

// "$ 1.200,00": the rate as an amount of the net currency.
export const formatRateMoney = (rate: number, netCurrency: string): string => {
  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency: netCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};
