import { describe, expect, it } from "vitest";

import { currencyChoices, firstFreeCurrency, initialRows } from "./utils";

describe("initialRows", () => {
  it("starts a new card with one empty cap in the default currency", () => {
    expect(initialRows([])).toEqual([{ key: 0, currency: "ARS", amount: "" }]);
  });

  it("starts an edit from the stored caps, as plain text", () => {
    expect(
      initialRows([
        { currency: "ARS", limitDecimal: "300000.00" },
        { currency: "USD", limitDecimal: "1200.50" },
      ]),
    ).toEqual([
      { key: 0, currency: "ARS", amount: "300000.00" },
      { key: 1, currency: "USD", amount: "1200.50" },
    ]);
  });
});

describe("firstFreeCurrency", () => {
  it("is the first currency of the list that no cap uses yet", () => {
    expect(firstFreeCurrency(["ARS"])).toBe("USD");
    expect(firstFreeCurrency(["ARS", "USD"])).toBe("EUR");
  });
});

describe("currencyChoices", () => {
  const ROWS = [
    { key: 0, currency: "ARS", amount: "" },
    { key: 1, currency: "USD", amount: "" },
  ];

  it("offers a row its own currency and every currency no other row uses", () => {
    const codes = currencyChoices(ROWS, 1).map(({ code }) => code);

    expect(codes).toContain("USD");
    expect(codes).toContain("EUR");
    expect(codes).not.toContain("ARS");
  });
});

describe("the currencies of a credit card cap", () => {
  it("are legal tender only, never a crypto asset", () => {
    const codes = currencyChoices(
      [{ key: 0, currency: "ARS", amount: "" }],
      0,
    ).map(({ code }) => code);

    expect(codes).toContain("USD");
    expect(codes).not.toContain("USDC");
    expect(codes).not.toContain("BTC");
  });
});
