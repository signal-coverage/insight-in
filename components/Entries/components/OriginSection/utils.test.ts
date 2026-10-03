import { describe, expect, it } from "vitest";

import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";

import { originCurrencyGroups, originRateLine } from "./utils";

describe("originCurrencyGroups", () => {
  it("lists the crypto assets first, in registry order, named after the asset", () => {
    const { crypto } = originCurrencyGroups("ARS");

    expect(crypto).toEqual([
      { code: "USDC", label: "USDC - USD Coin" },
      { code: "USDT", label: "USDT - Tether" },
      { code: "DAI", label: "DAI - Dai" },
    ]);
  });

  it("lists every ISO currency except the net one, in the order of the currency picker", () => {
    const { fiat } = originCurrencyGroups("ARS");

    expect(fiat.map(({ code }) => code)).toEqual(
      CURRENCY_OPTIONS.filter(({ code }) => code !== "ARS").map(
        ({ code }) => code,
      ),
    );
    expect(fiat.map(({ code }) => code)).toContain("USD");
    expect(fiat.map(({ code }) => code)).not.toContain("ARS");
    expect(fiat[0].label).toMatch(/^USD - /);
  });

  it("never offers a crypto asset in the ISO group", () => {
    const { fiat } = originCurrencyGroups("USD");

    expect(fiat.map(({ code }) => code)).not.toContain("USDC");
    expect(fiat.map(({ code }) => code)).not.toContain("USD");
  });
});

describe("originRateLine", () => {
  const line = (
    patch: Partial<Parameters<typeof originRateLine>[0]> = {},
  ): string | null =>
    originRateLine({
      netAmount: "12000",
      netCurrency: "ARS",
      originAmount: "10",
      originCurrency: "USDC",
      ...patch,
    });

  it("says what one unit of the origin cost in the net currency", () => {
    expect(line()).toMatch(/^Cotización implícita: 1 USDC = \$\s1\.200,00$/);
  });

  it("works for an ISO origin", () => {
    expect(
      line({
        netAmount: "990",
        netCurrency: "USD",
        originCurrency: "EUR",
        originAmount: "1000",
      }),
    ).toMatch(/^Cotización implícita: 1 EUR = US\$\s0,9900$/);
  });

  it("shows 4 decimals when the rate is under 1", () => {
    expect(line({ netAmount: "1", originAmount: "1000" })).toMatch(
      /= \$\s0,0010$/,
    );
  });

  it.each([
    ["no origin currency", { originCurrency: null }],
    ["an empty origin amount", { originAmount: "" }],
    ["an invalid origin amount", { originAmount: "abc" }],
    ["a zero origin amount", { originAmount: "0" }],
    ["too many decimals in the origin amount", { originAmount: "1.1234567" }],
    ["an empty net amount", { netAmount: "" }],
    ["an invalid net amount", { netAmount: "12,5" }],
    ["a zero net amount", { netAmount: "0" }],
    ["an origin equal to the net currency", { originCurrency: "ARS" }],
  ])("is hidden with %s", (_name, patch) => {
    expect(line(patch)).toBeNull();
  });
});
