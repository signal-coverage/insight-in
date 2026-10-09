import { describe, expect, it } from "vitest";

import { CRYPTO_CURRENCY_CODES } from "@/core/currencies/consts";

import { ALL_CURRENCY_CODES, LEGAL_TENDER_CURRENCY_CODES } from "./consts";
import {
  currencyExponent,
  formatMoney,
  isLegalTenderCode,
  isSupportedCurrencyCode,
  minorUnitsToNumber,
  toDecimalString,
  toMinorUnits,
} from "./money";

describe("LEGAL_TENDER_CURRENCY_CODES", () => {
  it("includes the currencies the app targets first", () => {
    expect(LEGAL_TENDER_CURRENCY_CODES).toEqual(
      expect.arrayContaining(["ARS", "USD", "EUR"]),
    );
  });

  it("does not include unknown codes nor any crypto asset", () => {
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("ZZZ");
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("USDC");
    expect(LEGAL_TENDER_CURRENCY_CODES).not.toContain("BTC");
  });
});

describe("ALL_CURRENCY_CODES", () => {
  it("is the legal tender and then the crypto assets, each once", () => {
    expect(ALL_CURRENCY_CODES).toEqual([
      ...LEGAL_TENDER_CURRENCY_CODES,
      ...CRYPTO_CURRENCY_CODES,
    ]);
    expect(new Set(ALL_CURRENCY_CODES).size).toBe(ALL_CURRENCY_CODES.length);
  });
});

describe("isLegalTenderCode and isSupportedCurrencyCode", () => {
  it("tell a legal tender currency, a crypto asset and an unknown code apart", () => {
    expect(isLegalTenderCode("ARS")).toBe(true);
    expect(isSupportedCurrencyCode("ARS")).toBe(true);
    expect(isLegalTenderCode("USDC")).toBe(false);
    expect(isSupportedCurrencyCode("USDC")).toBe(true);
    expect(isLegalTenderCode("ZZZ")).toBe(false);
    expect(isSupportedCurrencyCode("ZZZ")).toBe(false);
  });
});

describe("toMinorUnits", () => {
  it("converts a decimal with cents", () => {
    expect(toMinorUnits("1234.56", "USD")).toBe(123456);
  });

  it("pads a single fraction digit", () => {
    expect(toMinorUnits("10.5", "ARS")).toBe(1050);
  });

  it("converts a whole number", () => {
    expect(toMinorUnits("1234", "EUR")).toBe(123400);
  });

  it("respects currencies without minor units", () => {
    expect(toMinorUnits("1500", "JPY")).toBe(1500);
    expect(toMinorUnits("1500.5", "JPY")).toBeNull();
  });

  it("respects currencies with three minor digits", () => {
    expect(toMinorUnits("1.234", "KWD")).toBe(1234);
  });

  it("trims surrounding whitespace", () => {
    expect(toMinorUnits("  7.25 ", "USD")).toBe(725);
  });

  it("accepts zero", () => {
    expect(toMinorUnits("0", "USD")).toBe(0);
  });

  it("rejects more fraction digits than the currency allows", () => {
    expect(toMinorUnits("10.999", "USD")).toBeNull();
  });

  it.each(["", "abc", "-5", "1,234.56", ".5", "5.", "1e3", "1.2.3", "+4"])(
    "rejects malformed input %j",
    (input) => {
      expect(toMinorUnits(input, "USD")).toBeNull();
    },
  );

  it("rejects amounts beyond the safe integer range", () => {
    expect(toMinorUnits("90071992547409.92", "USD")).toBeNull();
  });

  it("rejects an unsupported currency", () => {
    expect(toMinorUnits("10", "ZZZ")).toBeNull();
  });
});

describe("currencyExponent", () => {
  it("is the number of minor-unit decimals of the currency", () => {
    expect(currencyExponent("USD")).toBe(2);
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("KWD")).toBe(3);
  });

  it("is 6 for every crypto asset of the registry", () => {
    expect(currencyExponent("USDC")).toBe(6);
    expect(currencyExponent("BTC")).toBe(6);
  });

  it("is null for an unsupported currency", () => {
    expect(currencyExponent("ZZZ")).toBeNull();
    expect(currencyExponent("usdc")).toBeNull();
  });
});

describe("minorUnitsToNumber", () => {
  it("converts a bigint to a number", () => {
    expect(minorUnitsToNumber(BigInt(123456))).toBe(123456);
  });

  it("throws when the value cannot be represented exactly", () => {
    expect(() =>
      minorUnitsToNumber(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1)),
    ).toThrow(RangeError);
  });
});

describe("toDecimalString", () => {
  it("renders minor units as a plain decimal", () => {
    expect(toDecimalString(123456, "USD")).toBe("1234.56");
  });

  it("keeps trailing zeros", () => {
    expect(toDecimalString(1050, "ARS")).toBe("10.50");
  });

  it("accepts bigint values", () => {
    expect(toDecimalString(BigInt(500), "EUR")).toBe("5.00");
  });

  it("renders currencies without minor units", () => {
    expect(toDecimalString(1500, "JPY")).toBe("1500");
  });

  it("round-trips with toMinorUnits", () => {
    const minor = toMinorUnits("42.07", "USD");

    expect(toDecimalString(minor as number, "USD")).toBe("42.07");
  });
});

describe("formatMoney", () => {
  // The default locale is es-AR: dot for thousands, comma for decimals, a space after the prefix.
  it("formats USD with its own prefix and Argentine grouping", () => {
    expect(formatMoney(123456, "USD")).toMatch(/^US\$\s1\.234,56$/);
  });

  it("formats EUR", () => {
    expect(formatMoney(123456, "EUR")).toMatch(/^EUR\s1\.234,56$/);
  });

  it("formats ARS with the peso sign", () => {
    expect(formatMoney(123456, "ARS")).toMatch(/^\$\s1\.234,56$/);
  });

  it("formats currencies without minor units", () => {
    expect(formatMoney(1500, "JPY")).toMatch(/^JPY\s1\.500$/);
  });

  it("accepts bigint values", () => {
    expect(formatMoney(BigInt(2500), "USD")).toMatch(/^US\$\s25,00$/);
  });

  it("honours a custom locale", () => {
    expect(formatMoney(123456, "EUR", "de-DE")).toMatch(/^1\.234,56\s€$/);
  });
});

describe("toMinorUnits with a crypto asset", () => {
  it("parses up to 6 decimals into millionths", () => {
    expect(toMinorUnits("1250.5", "USDC")).toBe(1250500000);
    expect(toMinorUnits("0.000001", "BTC")).toBe(1);
    expect(toMinorUnits("42", "ETH")).toBe(42000000);
  });

  it("refuses a seventh decimal", () => {
    expect(toMinorUnits("1.1234567", "USDC")).toBeNull();
  });

  it("refuses an amount beyond the safe integer range", () => {
    expect(toMinorUnits("9007199255", "USDT")).toBeNull();
    expect(toMinorUnits("9007199254", "USDT")).toBe(9007199254000000);
  });
});

describe("toDecimalString with a crypto asset", () => {
  it("keeps at least 2 decimals and at most 6, without trailing zeros", () => {
    expect(toDecimalString(1250500000, "USDC")).toBe("1250.50");
    expect(toDecimalString(1000000, "USDC")).toBe("1.00");
    expect(toDecimalString(1, "BTC")).toBe("0.000001");
    expect(toDecimalString(BigInt(1234567890), "DAI")).toBe("1234.56789");
  });

  it("keeps the sign of a negative amount", () => {
    expect(toDecimalString(-1500000, "USDC")).toBe("-1.50");
  });

  it("round-trips with toMinorUnits", () => {
    const minor = toMinorUnits("12.345678", "SOL") as number;

    expect(toDecimalString(minor, "SOL")).toBe("12.345678");
  });
});

describe("formatMoney with a crypto asset", () => {
  it("writes the amount with Argentine grouping and the code at the end", () => {
    expect(formatMoney(1250500000, "USDC")).toBe("1.250,50 USDC");
    expect(formatMoney(1234567, "ETH")).toBe("1,234567 ETH");
    expect(formatMoney(1, "BTC")).toBe("0,000001 BTC");
  });

  // Intl accepts any three letters as a currency and would print "BTC 1,50": a crypto code is never
  // handed to it as one, whether it has three letters or four.
  it.each([
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
  ])("never formats %s as an ISO currency", (code) => {
    expect(formatMoney(1500000, code)).toBe(`1,50 ${code}`);
  });

  it("keeps formatting legal tender as a currency", () => {
    expect(formatMoney(150, "USD")).toMatch(/^US\$\s1,50$/);
  });

  it("shows zero and a negative balance", () => {
    expect(formatMoney(0, "USDC")).toBe("0,00 USDC");
    expect(formatMoney(-1500000, "USDC")).toBe("-1,50 USDC");
  });

  it("accepts a bigint and honours a custom locale", () => {
    expect(formatMoney(BigInt(1250500000), "USDC")).toBe("1.250,50 USDC");
    expect(formatMoney(1250500000, "USDC", "en-US")).toBe("1,250.50 USDC");
  });
});
