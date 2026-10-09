import { CRYPTO_CURRENCIES } from "./consts";
import type { CryptoCurrency } from "./types";

const CRYPTO_BY_CODE = new Map<string, CryptoCurrency>(
  CRYPTO_CURRENCIES.map((currency) => [currency.code, currency]),
);

// Crypto codes are not ISO 4217: Intl.NumberFormat rejects them as a currency, so nothing in
// this registry is ever handed to it as one.
export const isCryptoCode = (code: string): boolean => CRYPTO_BY_CODE.has(code);

export const cryptoCurrency = (code: string): CryptoCurrency | null =>
  CRYPTO_BY_CODE.get(code) ?? null;

export const cryptoExponent = (code: string): number => {
  const currency = CRYPTO_BY_CODE.get(code);

  if (!currency) {
    throw new RangeError(`Unsupported crypto currency: ${code}`);
  }

  return currency.exponent;
};

const CRYPTO_RANK = new Map<string, number>(
  CRYPTO_CURRENCIES.map(({ code }, index) => [code, index]),
);

// The one order of every per-currency list: legal tender first, by code (the order the app always
// had), then the crypto assets in registry order. Unknown codes count as legal tender.
export const compareCurrencyCodes = (a: string, b: string): number => {
  const rankA = CRYPTO_RANK.get(a);
  const rankB = CRYPTO_RANK.get(b);

  if (rankA === undefined && rankB === undefined) {
    return a.localeCompare(b);
  }

  if (rankA === undefined) {
    return -1;
  }

  if (rankB === undefined) {
    return 1;
  }

  return rankA - rankB;
};
