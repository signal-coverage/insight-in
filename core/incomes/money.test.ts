import { describe, expect, it } from "vitest";

import { SUPPORTED_CURRENCY_CODES } from "./consts";
import {
  currencyExponent,
  formatMoney,
  minorUnitsToNumber,
  toDecimalString,
  toMinorUnits,
} from "./money";

describe("SUPPORTED_CURRENCY_CODES", () => {
  it("includes the currencies the app targets first", () => {
    expect(SUPPORTED_CURRENCY_CODES).toEqual(
      expect.arrayContaining(["ARS", "USD", "EUR"]),
    );
  });

  it("does not include unknown codes", () => {
    expect(SUPPORTED_CURRENCY_CODES).not.toContain("ZZZ");
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

  it("is null for an unsupported currency", () => {
    expect(currencyExponent("ZZZ")).toBeNull();
    expect(currencyExponent("USDC")).toBeNull();
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
