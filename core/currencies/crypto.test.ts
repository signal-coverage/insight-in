import { describe, expect, it } from "vitest";

import {
  CRYPTO_CURRENCIES,
  CRYPTO_CURRENCY_CODES,
  CRYPTO_EXPONENT,
} from "./consts";
import {
  compareCurrencyCodes,
  cryptoCurrency,
  cryptoExponent,
  isCryptoCode,
} from "./crypto";

const CODES = [
  "USDC",
  "USDT",
  "DAI",
  "BTC",
  "ETH",
  "XMR",
  "SOL",
  "BNB",
  "LTC",
  "TRX",
];

describe("CRYPTO_CURRENCIES", () => {
  it("lists the ten assets in the order the pickers show them, each with its English name", () => {
    expect(CRYPTO_CURRENCIES.map(({ code }) => code)).toEqual(CODES);
    expect(CRYPTO_CURRENCIES.map(({ name }) => name)).toEqual([
      "USD Coin",
      "Tether",
      "Dai",
      "Bitcoin",
      "Ethereum",
      "Monero",
      "Solana",
      "BNB",
      "Litecoin",
      "TRON",
    ]);
  });

  it("caps every asset at 6 decimals, which is what a safe integer can hold", () => {
    expect(CRYPTO_EXPONENT).toBe(6);
    expect(CRYPTO_CURRENCIES).toHaveLength(10);
    CRYPTO_CURRENCIES.forEach(({ exponent }) => expect(exponent).toBe(6));
  });

  it("exposes the codes in the same order", () => {
    expect(CRYPTO_CURRENCY_CODES).toEqual(CODES);
  });
});

describe("isCryptoCode", () => {
  it.each(CODES)("recognises %s", (code) => {
    expect(isCryptoCode(code)).toBe(true);
  });

  it.each(["USD", "ARS", "usdc", "XRP", ""])("rejects %j", (code) => {
    expect(isCryptoCode(code)).toBe(false);
  });
});

describe("cryptoExponent", () => {
  it("is 6 for every registered asset", () => {
    expect(cryptoExponent("USDC")).toBe(6);
    expect(cryptoExponent("BTC")).toBe(6);
  });

  it("refuses a code that is not in the registry", () => {
    expect(() => cryptoExponent("USD")).toThrow(RangeError);
  });
});

describe("cryptoCurrency", () => {
  it("returns the descriptor of a registered asset", () => {
    expect(cryptoCurrency("XMR")).toEqual({
      code: "XMR",
      name: "Monero",
      exponent: 6,
    });
  });

  it("returns null for anything else", () => {
    expect(cryptoCurrency("EUR")).toBeNull();
  });
});

describe("compareCurrencyCodes", () => {
  it("puts legal tender first, by code as always, then the crypto assets in registry order", () => {
    expect(
      ["BTC", "USD", "USDC", "ARS", "DAI", "EUR", "USDT"].sort(
        compareCurrencyCodes,
      ),
    ).toEqual(["ARS", "EUR", "USD", "USDC", "USDT", "DAI", "BTC"]);
  });

  it("keeps the alphabetical order of legal tender alone", () => {
    expect(["USD", "ARS", "BRL"].sort(compareCurrencyCodes)).toEqual([
      "ARS",
      "BRL",
      "USD",
    ]);
  });
});
