import { describe, expect, it } from "vitest";

import { CRYPTO_CURRENCIES, CRYPTO_EXPONENT } from "./consts";
import { cryptoCurrency, cryptoExponent, isCryptoCode } from "./crypto";

describe("CRYPTO_CURRENCIES", () => {
  it("starts with USDC, USDT and DAI, each described by code, name and exponent", () => {
    expect(CRYPTO_CURRENCIES.map(({ code }) => code)).toEqual([
      "USDC",
      "USDT",
      "DAI",
    ]);
    expect(CRYPTO_CURRENCIES.map(({ name }) => name)).toEqual([
      "USD Coin",
      "Tether",
      "Dai",
    ]);
  });

  it("caps every asset at 6 decimals, which is what a safe integer can hold", () => {
    expect(CRYPTO_EXPONENT).toBe(6);
    CRYPTO_CURRENCIES.forEach(({ exponent }) => expect(exponent).toBe(6));
  });
});

describe("isCryptoCode", () => {
  it.each(["USDC", "USDT", "DAI"])("recognises %s", (code) => {
    expect(isCryptoCode(code)).toBe(true);
  });

  it.each(["USD", "ARS", "usdc", "BTC", ""])("rejects %j", (code) => {
    expect(isCryptoCode(code)).toBe(false);
  });
});

describe("cryptoExponent", () => {
  it("is 6 for every registered asset", () => {
    expect(cryptoExponent("USDC")).toBe(6);
    expect(cryptoExponent("DAI")).toBe(6);
  });

  it("refuses a code that is not in the registry", () => {
    expect(() => cryptoExponent("USD")).toThrow(RangeError);
  });
});

describe("cryptoCurrency", () => {
  it("returns the descriptor of a registered asset", () => {
    expect(cryptoCurrency("USDT")).toEqual({
      code: "USDT",
      name: "Tether",
      exponent: 6,
    });
  });

  it("returns null for anything else", () => {
    expect(cryptoCurrency("EUR")).toBeNull();
  });
});
