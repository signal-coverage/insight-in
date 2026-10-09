import { describe, expect, it } from "vitest";

import {
  parseCurrencyParam,
  parseSectionParam,
  SUMMARY_SECTIONS,
  summariesForTabs,
  tabCurrencies,
  visibleTabs,
  zeroSummary,
} from "./tabs";
import type { CurrencySummary } from "./types";

const ARS: CurrencySummary = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 570000,
  target: 590000,
  pendingReimbursements: 4000,
};

const AED_ROW: CurrencySummary = { ...zeroSummary("AED"), previous: 5 };
const USD_ROW: CurrencySummary = { ...zeroSummary("USD"), previous: 70 };

describe("tabCurrencies", () => {
  it("puts ARS first, then the others in the app's order: legal tender, then crypto", () => {
    expect(tabCurrencies(["USD", "USDC"], ["EUR", "ARS"])).toEqual([
      "ARS",
      "EUR",
      "USD",
      "USDC",
    ]);
  });

  it("pulls ARS to the front even when other codes sort before it", () => {
    expect(tabCurrencies(["AED", "USD"], ["ARS"])).toEqual([
      "ARS",
      "AED",
      "USD",
    ]);
  });

  it("gives a currency held only in an account a tab of its own", () => {
    expect(tabCurrencies([], ["USD"])).toEqual(["USD"]);
  });

  it("never repeats a currency that is in both lists", () => {
    expect(tabCurrencies(["ARS", "USD"], ["USD", "ARS"])).toEqual([
      "ARS",
      "USD",
    ]);
  });

  it("is ARS alone when there is nothing at all, so the month keeps its shape", () => {
    expect(tabCurrencies([], [])).toEqual(["ARS"]);
  });
});

describe("summariesForTabs", () => {
  it("keeps every row the summary computed, untouched, and adds a zero row for a currency only held in an account", () => {
    const rows = summariesForTabs([ARS], ["USD"]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toBe(ARS);
    expect(rows[1]).toEqual(zeroSummary("USD"));
    expect(rows[1]).toEqual({
      currency: "USD",
      incomes: { total: 0, settled: 0, pending: 0 },
      expenses: { total: 0, settled: 0, pending: 0 },
      previous: 0,
      current: 0,
      target: 0,
      pendingReimbursements: 0,
    });
  });

  it("adds no row when every account currency already has one", () => {
    expect(summariesForTabs([ARS], ["ARS"])).toEqual([ARS]);
  });

  it("puts a zero ARS row first when the summary has none, keeping the other rows as they are", () => {
    const rows = summariesForTabs([USD_ROW], ["ARS"]);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(zeroSummary("ARS"));
    expect(rows[1]).toBe(USD_ROW);
  });

  it("keeps ARS first even when the summary has a row whose code sorts before it", () => {
    const rows = summariesForTabs([AED_ROW, USD_ROW], ["ARS"]);

    expect(rows).toHaveLength(3);
    expect(rows.map(({ currency }) => currency)).toEqual(["ARS", "AED", "USD"]);
    expect(rows[0]).toEqual(zeroSummary("ARS"));
    expect(rows[1]).toBe(AED_ROW);
  });
});

describe("parseCurrencyParam", () => {
  it("reads the code the address asks for, in capitals", () => {
    expect(parseCurrencyParam("USD")).toBe("USD");
    expect(parseCurrencyParam(" usdc ")).toBe("USDC");
  });

  it("reads nothing from a missing, empty or repeated parameter", () => {
    expect(parseCurrencyParam(undefined)).toBeNull();
    expect(parseCurrencyParam("")).toBeNull();
    expect(parseCurrencyParam(["USD", "EUR"])).toBeNull();
  });
});

describe("visibleTabs", () => {
  const rows = ["ARS", "EUR", "USD", "USDC"].map((currency) => ({ currency }));
  const codes = (list: readonly { currency: string }[]) =>
    list.map(({ currency }) => currency);

  it("keeps every tab when nothing is hidden", () => {
    expect(codes(visibleTabs(rows, []))).toEqual(["ARS", "EUR", "USD", "USDC"]);
  });

  it("drops the hidden ones and keeps the order of the rest", () => {
    expect(codes(visibleTabs(rows, ["USDC", "ARS"]))).toEqual(["EUR", "USD"]);
  });

  it("falls back to every tab when all of them are hidden", () => {
    expect(codes(visibleTabs(rows, ["USDC", "ARS", "EUR", "USD"]))).toEqual([
      "ARS",
      "EUR",
      "USD",
      "USDC",
    ]);
  });

  it("ignores a hidden code the user has no tab for", () => {
    expect(codes(visibleTabs(rows, ["JPY"]))).toEqual([
      "ARS",
      "EUR",
      "USD",
      "USDC",
    ]);
    expect(codes(visibleTabs(rows, ["JPY", "EUR"]))).toEqual([
      "ARS",
      "USD",
      "USDC",
    ]);
  });

  it("falls back to every tab when the only tab is hidden, even beside codes the user does not have", () => {
    expect(codes(visibleTabs(rows.slice(0, 1), ["ARS", "JPY"]))).toEqual([
      "ARS",
    ]);
  });

  it("hands on the very same row objects", () => {
    expect(visibleTabs(rows, ["ARS"])[0]).toBe(rows[1]);
  });
});

describe("parseSectionParam", () => {
  it("reads each valid section from the address", () => {
    expect(parseSectionParam("month")).toBe("month");
    expect(parseSectionParam("history")).toBe("history");
    expect(parseSectionParam("accounts")).toBe("accounts");
  });

  it("falls back to accounts for a missing, empty, unknown or repeated value", () => {
    expect(parseSectionParam(undefined)).toBe("accounts");
    expect(parseSectionParam("")).toBe("accounts");
    expect(parseSectionParam("nope")).toBe("accounts");
    expect(parseSectionParam(["month", "history"])).toBe("accounts");
  });

  it("lists the sections in the order of the tabs, accounts first", () => {
    expect(SUMMARY_SECTIONS).toEqual(["accounts", "month", "history"]);
  });
});
