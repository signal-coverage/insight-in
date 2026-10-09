import { describe, expect, it } from "vitest";

import { buildCurrencyOptions } from "./utils";

describe("buildCurrencyOptions", () => {
  it("lists the currencies in use once each, legal tender by code first and then the crypto ones", () => {
    expect(buildCurrencyOptions(["USDC", "USD", "ARS", "BTC"], null)).toEqual([
      { id: "ARS", label: "ARS" },
      { id: "USD", label: "USD" },
      { id: "USDC", label: "USDC" },
      { id: "BTC", label: "BTC" },
    ]);
  });

  // Characterization of the existing behaviour: it passes before the comparator exists.
  it("adds the active currency when no entry uses it, so a shared link never shows an empty field", () => {
    expect(buildCurrencyOptions(["ARS"], "USDT").map(({ id }) => id)).toEqual([
      "ARS",
      "USDT",
    ]);
    expect(
      buildCurrencyOptions(["ARS", "USDT"], "USDT").map(({ id }) => id),
    ).toEqual(["ARS", "USDT"]);
  });
});
