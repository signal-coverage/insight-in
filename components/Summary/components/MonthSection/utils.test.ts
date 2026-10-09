import { describe, expect, it } from "vitest";

import {
  chartsFor,
  currencyParams,
  resolveCurrency,
  tabAddress,
} from "./utils";

describe("resolveCurrency", () => {
  it("is the chosen currency when it has a tab", () => {
    expect(resolveCurrency("USD", ["ARS", "USD"])).toBe("USD");
  });

  it("falls back to the first tab for a currency without one, or for none chosen", () => {
    expect(resolveCurrency("XYZ", ["ARS", "USD"])).toBe("ARS");
    expect(resolveCurrency(null, ["USD", "USDC"])).toBe("USD");
  });

  it("is ARS when there is no tab at all", () => {
    expect(resolveCurrency("USD", [])).toBe("ARS");
  });
});

describe("currencyParams", () => {
  it("writes any currency but the default one", () => {
    expect(currencyParams("USD")).toEqual({ currency: "USD" });
    expect(currencyParams("USDC")).toEqual({ currency: "USDC" });
  });

  it("writes nothing for ARS or for no choice", () => {
    expect(currencyParams("ARS")).toEqual({});
    expect(currencyParams(null)).toEqual({});
  });
});

describe("chartsFor", () => {
  it("is the currency's own charts", () => {
    const usd = { currency: "USD", monthly: [], categories: [], daily: [] };

    expect(chartsFor([{ ...usd, currency: "ARS" }, usd], "USD")).toBe(usd);
  });

  it("is empty charts for a currency with nothing to draw", () => {
    expect(chartsFor([], "EUR")).toEqual({
      currency: "EUR",
      monthly: [],
      categories: [],
      daily: [],
    });
  });
});

describe("tabAddress", () => {
  const at = (search: string, hash = "") => ({
    pathname: "/dashboard/overview",
    search,
    hash,
  });

  it("writes the currency and keeps every other parameter and the hash", () => {
    expect(
      tabAddress(at("?status=PLANNED", "#a"), "2026-09", "2026-09", "USD"),
    ).toBe("/dashboard/overview?status=PLANNED&currency=USD#a");
  });

  it("drops the currency for ARS but keeps the rest", () => {
    expect(
      tabAddress(
        at("?currency=USD&status=PLANNED"),
        "2026-09",
        "2026-09",
        "ARS",
      ),
    ).toBe("/dashboard/overview?status=PLANNED");
  });

  it("keeps the month shown unless it is the month in course", () => {
    expect(tabAddress(at(""), "2026-08", "2026-09", "USD")).toBe(
      "/dashboard/overview?month=2026-08&currency=USD",
    );
    expect(tabAddress(at("?month=2026-09"), "2026-09", "2026-09", "ARS")).toBe(
      "/dashboard/overview",
    );
  });
});
