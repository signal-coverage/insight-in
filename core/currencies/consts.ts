import type { CryptoCurrency } from "./types";

// Every asset is kept with 6 decimals: on chain some have 8 (BTC) or 18 (ETH, DAI), which the
// number-based money helpers cannot hold (a safe integer holds about 9e15), so anything below a
// millionth is dust the app does not track. 6 still leaves about 9,000 million units per amount.
export const CRYPTO_EXPONENT = 6;

// In the order the pickers list them. Adding an asset is one line.
export const CRYPTO_CURRENCIES: readonly CryptoCurrency[] = [
  { code: "USDC", name: "USD Coin", exponent: CRYPTO_EXPONENT },
  { code: "USDT", name: "Tether", exponent: CRYPTO_EXPONENT },
  { code: "DAI", name: "Dai", exponent: CRYPTO_EXPONENT },
  { code: "BTC", name: "Bitcoin", exponent: CRYPTO_EXPONENT },
  { code: "ETH", name: "Ethereum", exponent: CRYPTO_EXPONENT },
  { code: "XMR", name: "Monero", exponent: CRYPTO_EXPONENT },
  { code: "SOL", name: "Solana", exponent: CRYPTO_EXPONENT },
  { code: "BNB", name: "BNB", exponent: CRYPTO_EXPONENT },
  { code: "LTC", name: "Litecoin", exponent: CRYPTO_EXPONENT },
  { code: "TRX", name: "TRON", exponent: CRYPTO_EXPONENT },
];

export const CRYPTO_CURRENCY_CODES: readonly string[] = CRYPTO_CURRENCIES.map(
  ({ code }) => code,
);

// A crypto amount always shows at least cents, and at most the decimals the asset keeps.
export const CRYPTO_MIN_FRACTION_DIGITS = 2;

// A rate below 1 needs more precision to say something ("1 DAI = $ 0,0008").
export const RATE_FRACTION_DIGITS = 2;
export const SMALL_RATE_FRACTION_DIGITS = 4;

// Under this a rate would print as "0,0000" with 4 decimals; it shows significant digits instead.
export const TINY_RATE = 0.00005;
export const TINY_RATE_SIGNIFICANT_DIGITS = 4;
