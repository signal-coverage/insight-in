import { DISPLAY_LOCALE } from "@/core/incomes/consts";
import {
  currencyExponent,
  formatDecimal,
  formatMoney,
  isSupportedCurrencyCode,
  toDecimalString,
  toMinorUnits,
  toTrimmedDecimal,
} from "@/core/incomes/money";

import {
  RATE_FRACTION_DIGITS,
  SMALL_RATE_FRACTION_DIGITS,
  TINY_RATE,
  TINY_RATE_SIGNIFICANT_DIGITS,
} from "./consts";
import { isCryptoCode } from "./crypto";

// The "origin" of an entry: the currency (a crypto asset or any ISO currency) and the amount the net
// amount came from, or was priced in. It is only a reference. Every conversion and format is the money
// module's, which knows both kinds of currency; this file only adds what is specific to an origin.

export const originExponent = (code: string): number | null =>
  currencyExponent(code);

// An origin is any supported currency, and never the currency of the net amount (that would not be
// an origin at all).
export const isOriginCurrencyCode = (
  code: string,
  netCurrency: string,
): boolean => code !== netCurrency && isSupportedCurrencyCode(code);

// Parses a plain decimal string ("1234.56") into minor units of the origin currency. Null for
// malformed input, more decimals than the currency keeps, an unknown code or a value beyond the
// safe integer range.
export const toOriginMinorUnits = (
  input: string,
  code: string,
): number | null => toMinorUnits(input, code);

// Plain decimal representation, suitable for prefilling an input.
export const toOriginDecimalString = (
  minorUnits: number | bigint,
  code: string,
): string => toDecimalString(minorUnits, code);

// "1.000,50 USDC" for a crypto asset, "US$ 1.000,50" for an ISO currency.
export const formatOrigin = (
  minorUnits: number | bigint,
  code: string,
): string => formatMoney(minorUnits, code);

// The short form used as an accessible name: the code last for any currency, and no decimals for a
// whole amount ("1.000 USDC").
export const formatOriginLabel = (
  minorUnits: number | bigint,
  code: string,
): string => {
  const exponent = currencyExponent(code);

  if (exponent === null) {
    throw new RangeError(`Unsupported currency: ${code}`);
  }

  const decimal = toTrimmedDecimal(minorUnits, exponent, 0);
  const isWhole = !decimal.includes(".");
  const minimum = isWhole ? 0 : Math.min(2, exponent);

  return `${formatDecimal(decimal, minimum, exponent)} ${code}`;
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
  const originExp = currencyExponent(originCode);

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

// "1.200,00"; a rate under 1 keeps 4 decimals so it does not collapse into zero, and one too small for
// 4 decimals keeps its significant digits ("0,00000001").
export const formatRate = (rate: number): string => {
  if (rate > 0 && rate < TINY_RATE) {
    return new Intl.NumberFormat(DISPLAY_LOCALE, {
      maximumSignificantDigits: TINY_RATE_SIGNIFICANT_DIGITS,
    }).format(rate);
  }

  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};

// "$ 1.200,00": the rate as an amount of the net currency. A crypto net currency cannot go through
// Intl, so it reads "0,0008 USDC". A rate too small for 4 decimals keeps its significant digits
// ("0,00001234 BTC") instead of rounding to "0,0000" (see formatRate).
export const formatRateMoney = (rate: number, netCurrency: string): string => {
  if (isCryptoCode(netCurrency)) {
    return `${formatRate(rate)} ${netCurrency}`;
  }

  const digits = rateFractionDigits(rate);

  return new Intl.NumberFormat(DISPLAY_LOCALE, {
    style: "currency",
    currency: netCurrency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(rate);
};
