import type { CryptoCurrency } from "./types";

// The three stablecoins have 6 (USDC, USDT) or 18 (DAI) decimals on chain. 18 cannot be handled
// with the number-based money helpers (a safe integer holds about 9e15), so every asset is capped at
// 6 decimals: precise enough for a reference amount and still roomy (about 9,000 million units).
export const CRYPTO_EXPONENT = 6;

export const CRYPTO_CURRENCIES: readonly CryptoCurrency[] = [
  { code: "USDC", name: "USD Coin", exponent: CRYPTO_EXPONENT },
  { code: "USDT", name: "Tether", exponent: CRYPTO_EXPONENT },
  { code: "DAI", name: "Dai", exponent: CRYPTO_EXPONENT },
];

// A crypto amount always shows at least cents, and at most the decimals the asset keeps.
export const CRYPTO_MIN_FRACTION_DIGITS = 2;

// A rate below 1 needs more precision to say something ("1 DAI = $ 0,0008").
export const RATE_FRACTION_DIGITS = 2;
export const SMALL_RATE_FRACTION_DIGITS = 4;
