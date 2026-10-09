import { describe, expect, it } from "vitest";

import {
  formatOrigin,
  formatOriginLabel,
  formatRate,
  formatRateMoney,
  impliedRate,
  isOriginCurrencyCode,
  originExponent,
  toOriginDecimalString,
  toOriginMinorUnits,
} from "./origin";

describe("originExponent", () => {
  it("is the registry exponent for a crypto asset and the ISO one for a currency", () => {
    expect(originExponent("USDC")).toBe(6);
    expect(originExponent("EUR")).toBe(2);
    expect(originExponent("JPY")).toBe(0);
  });

  it("is 6 for every registered asset", () => {
    expect(originExponent("BTC")).toBe(6);
  });

  it("is null for an unknown code", () => {
    expect(originExponent("ZZZ")).toBeNull();
  });
});

describe("isOriginCurrencyCode", () => {
  it("accepts a crypto asset whatever the net currency is", () => {
    expect(isOriginCurrencyCode("USDC", "ARS")).toBe(true);
    expect(isOriginCurrencyCode("USDT", "USD")).toBe(true);
  });

  it("accepts a supported ISO currency different from the net one", () => {
    expect(isOriginCurrencyCode("USD", "ARS")).toBe(true);
  });

  it("rejects the net currency itself", () => {
    expect(isOriginCurrencyCode("ARS", "ARS")).toBe(false);
  });

  it("accepts any registered asset, and an ISO origin for a crypto net amount", () => {
    expect(isOriginCurrencyCode("BTC", "ARS")).toBe(true);
    expect(isOriginCurrencyCode("ARS", "USDC")).toBe(true);
  });

  it("rejects a crypto origin equal to a crypto net currency", () => {
    expect(isOriginCurrencyCode("USDC", "USDC")).toBe(false);
  });

  it.each(["XRP", "", "usdc", "ZZZ"])("rejects an unknown code %j", (code) => {
    expect(isOriginCurrencyCode(code, "ARS")).toBe(false);
  });
});

describe("toOriginMinorUnits", () => {
  it("parses a crypto amount into millionths", () => {
    expect(toOriginMinorUnits("1000.5", "USDC")).toBe(1000500000);
    expect(toOriginMinorUnits("0.000001", "USDT")).toBe(1);
    expect(toOriginMinorUnits("42", "DAI")).toBe(42000000);
  });

  it("trims surrounding whitespace", () => {
    expect(toOriginMinorUnits(" 7.25 ", "USDC")).toBe(7250000);
  });

  it("caps the precision at 6 decimals", () => {
    expect(toOriginMinorUnits("1.1234567", "USDC")).toBeNull();
  });

  it("parses an ISO amount with that currency's decimals", () => {
    expect(toOriginMinorUnits("10.5", "EUR")).toBe(1050);
    expect(toOriginMinorUnits("1500", "JPY")).toBe(1500);
    expect(toOriginMinorUnits("10.555", "EUR")).toBeNull();
  });

  it.each(["", "abc", "-5", "1,5", ".5", "5.", "1e3", "1.2.3", "+4"])(
    "rejects malformed text %j",
    (input) => {
      expect(toOriginMinorUnits(input, "USDC")).toBeNull();
      expect(toOriginMinorUnits(input, "EUR")).toBeNull();
    },
  );

  it("rejects an amount beyond the safe integer range", () => {
    expect(toOriginMinorUnits("9007199255", "USDC")).toBeNull();
    expect(toOriginMinorUnits("9007199254", "USDC")).toBe(9007199254000000);
  });

  it("rejects an unknown code", () => {
    expect(toOriginMinorUnits("10", "ZZZ")).toBeNull();
  });

  it("parses any registered asset", () => {
    expect(toOriginMinorUnits("0.5", "BTC")).toBe(500000);
  });
});

describe("toOriginDecimalString", () => {
  it("shows a crypto amount with at least 2 decimals and at most 6, without trailing zeros", () => {
    expect(toOriginDecimalString(1000500000, "USDC")).toBe("1000.50");
    expect(toOriginDecimalString(1000000000, "USDC")).toBe("1000.00");
    expect(toOriginDecimalString(1, "USDC")).toBe("0.000001");
    expect(toOriginDecimalString(1234567890, "DAI")).toBe("1234.56789");
  });

  it("delegates to the ISO helper for a currency", () => {
    expect(toOriginDecimalString(123456, "USD")).toBe("1234.56");
  });

  it("round-trips with toOriginMinorUnits", () => {
    const minor = toOriginMinorUnits("12.345678", "USDT") as number;

    expect(toOriginDecimalString(minor, "USDT")).toBe("12.345678");
  });
});

describe("formatOrigin", () => {
  it("writes a crypto amount with Argentine grouping and the code at the end", () => {
    expect(formatOrigin(1000500000, "USDC")).toBe("1.000,50 USDC");
    expect(formatOrigin(1000000000, "USDC")).toBe("1.000,00 USDC");
  });

  it("trims to the decimals the amount really has, never fewer than 2", () => {
    expect(formatOrigin(1500000, "USDT")).toBe("1,50 USDT");
    expect(formatOrigin(1234567, "DAI")).toBe("1,234567 DAI");
    expect(formatOrigin(1, "USDC")).toBe("0,000001 USDC");
  });

  it("delegates an ISO currency to the money formatter", () => {
    expect(formatOrigin(123456, "USD")).toMatch(/^US\$\s1\.234,56$/);
    expect(formatOrigin(1500, "JPY")).toMatch(/^JPY\s1\.500$/);
  });

  it("accepts a bigint", () => {
    expect(formatOrigin(BigInt(1000500000), "USDC")).toBe("1.000,50 USDC");
  });
});

describe("formatOriginLabel", () => {
  it("drops the decimals of a whole amount and keeps the code at the end", () => {
    expect(formatOriginLabel(1000000000, "USDC")).toBe("1.000 USDC");
    expect(formatOriginLabel(1000, "JPY")).toBe("1.000 JPY");
  });

  it("keeps the decimals of a fractional amount", () => {
    expect(formatOriginLabel(1000500000, "USDC")).toBe("1.000,50 USDC");
    expect(formatOriginLabel(100050, "EUR")).toBe("1.000,50 EUR");
  });
});

describe("impliedRate", () => {
  it("is the net amount over the origin amount, in whole units of each", () => {
    // $ 12.000,00 net out of 10 USDC.
    expect(impliedRate(1200000, "ARS", 10000000, "USDC")).toBe(1200);
  });

  it("works between two ISO currencies", () => {
    // 990,00 USD out of 1.000,00 EUR.
    expect(impliedRate(99000, "USD", 100000, "EUR")).toBeCloseTo(0.99, 10);
  });

  it("is below 1 when the origin is worth more than one net unit", () => {
    expect(impliedRate(5, "JPY", 1000000, "USDC")).toBe(5);
    expect(impliedRate(100, "USD", 100000000, "USDC")).toBe(0.01);
  });

  it("is null when either amount is not positive or a currency is unknown", () => {
    expect(impliedRate(1200, "ARS", 0, "USDC")).toBeNull();
    expect(impliedRate(0, "ARS", 1000000, "USDC")).toBeNull();
    expect(impliedRate(1200, "ZZZ", 1000000, "USDC")).toBeNull();
    expect(impliedRate(1200, "ARS", 1000000, "ZZZ")).toBeNull();
  });

  it("works with a crypto net amount", () => {
    // 1,00 USDC net out of $ 1.250,00.
    expect(impliedRate(1000000, "USDC", 125000, "ARS")).toBe(0.0008);
  });
});

describe("formatRate", () => {
  it("shows 2 decimals from 1 up", () => {
    expect(formatRate(1200)).toBe("1.200,00");
    expect(formatRate(1)).toBe("1,00");
  });

  it("shows 4 decimals under 1", () => {
    expect(formatRate(0.0008)).toBe("0,0008");
    expect(formatRate(0.99)).toBe("0,9900");
  });
});

describe("formatRateMoney", () => {
  it("prefixes the net currency, with 2 decimals from 1 up", () => {
    expect(formatRateMoney(1200, "ARS")).toMatch(/^\$\s1\.200,00$/);
  });

  it("shows 4 decimals under 1", () => {
    expect(formatRateMoney(0.0008, "ARS")).toMatch(/^\$\s0,0008$/);
  });

  it("writes the rate and then the code for a crypto net currency, never through Intl", () => {
    expect(formatRateMoney(0.0008, "USDC")).toBe("0,0008 USDC");
    expect(formatRateMoney(1200, "BTC")).toBe("1.200,00 BTC");
  });

  it("keeps significant digits for a tiny rate in a crypto net currency instead of printing zero", () => {
    expect(formatRateMoney(0.00001234, "BTC")).toBe("0,00001234 BTC");
    expect(formatRateMoney(0.0000001, "ETH")).toBe("0,0000001 ETH");
    expect(formatRateMoney(0.0001, "BTC")).toBe("0,0001 BTC");
  });

  it("keeps the currency prefix for a legal tender net currency", () => {
    expect(formatRateMoney(1200, "USD")).toMatch(/^US\$\s1\.200,00$/);
  });
});
