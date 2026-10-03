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
