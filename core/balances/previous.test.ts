import { describe, expect, it } from "vitest";

import { previousBalances, priorEntriesWindow } from "./previous";
import type { OpeningBalances, SettledFlow } from "./types";

const flow = (
  currency: string,
  medium: SettledFlow["medium"],
  kind: SettledFlow["kind"],
  amount: number,
): SettledFlow => ({ currency, medium, kind, amount });

const opening = (
  month: string,
  ...amounts: [string, "DIGITAL" | "CASH", number][]
): OpeningBalances => ({
  month,
  amounts: amounts.map(([currency, medium, amount]) => ({
    currency,
    medium,
    amount,
  })),
});

describe("priorEntriesWindow", () => {
  it("reaches back to the very first entry when there is no opening balance", () => {
    expect(priorEntriesWindow("2026-09", null)).toEqual({
      from: null,
      to: "2026-08-31",
    });
  });

  it("ends the day before the month starts, across a year rollover", () => {
    expect(priorEntriesWindow("2027-01", null)?.to).toBe("2026-12-31");
  });

  it("ends on the 29th of a leap February", () => {
    expect(priorEntriesWindow("2028-03", null)?.to).toBe("2028-02-29");
  });

  it("looks at nothing before the opening balance month", () => {
    expect(priorEntriesWindow("2026-05", "2026-06")).toBeNull();
  });

  it("looks at nothing in the opening balance month itself: the balance is the starting point", () => {
    expect(priorEntriesWindow("2026-06", "2026-06")).toBeNull();
  });

  it("starts at the first day of the opening month for any later month", () => {
    expect(priorEntriesWindow("2026-09", "2026-06")).toEqual({
      from: "2026-06-01",
      to: "2026-08-31",
    });
  });

  it("works across years", () => {
    expect(priorEntriesWindow("2027-02", "2026-11")).toEqual({
      from: "2026-11-01",
      to: "2027-01-31",
    });
  });
});

describe("previousBalances without an opening balance", () => {
  it("is the net of everything settled before the month, income minus expense", () => {
    const result = previousBalances("2026-09", null, [
      flow("ARS", "DIGITAL", "income", 10000),
      flow("ARS", "DIGITAL", "expense", 3500),
    ]);

    expect(result).toEqual([{ currency: "ARS", digital: 6500, cash: 0 }]);
  });

  it("keeps digital and cash apart", () => {
    const result = previousBalances("2026-09", null, [
      flow("ARS", "DIGITAL", "income", 10000),
      flow("ARS", "CASH", "income", 2000),
      flow("ARS", "CASH", "expense", 500),
    ]);

    expect(result).toEqual([{ currency: "ARS", digital: 10000, cash: 1500 }]);
  });

  it("keeps currencies apart and sorted by code", () => {
    const result = previousBalances("2026-09", null, [
      flow("USD", "DIGITAL", "income", 100),
      flow("ARS", "DIGITAL", "income", 200),
    ]);

    expect(result.map((row) => row.currency)).toEqual(["ARS", "USD"]);
  });

  it("can be negative when more went out than came in", () => {
    const result = previousBalances("2026-09", null, [
      flow("ARS", "DIGITAL", "income", 1000),
      flow("ARS", "DIGITAL", "expense", 4000),
    ]);

    expect(result[0].digital).toBe(-3000);
  });

  it("leaves out a currency whose balance is zero on both mediums", () => {
    const result = previousBalances("2026-09", null, [
      flow("ARS", "DIGITAL", "income", 1000),
      flow("ARS", "DIGITAL", "expense", 1000),
    ]);

    expect(result).toEqual([]);
  });

  it("is empty when nothing came before", () => {
    expect(previousBalances("2026-09", null, [])).toEqual([]);
  });
});

describe("previousBalances with an opening balance", () => {
  const OPENING = opening(
    "2026-06",
    ["ARS", "DIGITAL", 50000],
    ["ARS", "CASH", 8000],
  );

  it("is zero before the opening month: it does not apply there, and nothing is invented", () => {
    const result = previousBalances("2026-05", OPENING, [
      flow("ARS", "DIGITAL", "income", 999),
    ]);

    expect(result).toEqual([]);
  });

  it("is exactly the opening amounts in the opening month", () => {
    const result = previousBalances("2026-06", OPENING, [
      flow("ARS", "DIGITAL", "income", 999),
    ]);

    expect(result).toEqual([{ currency: "ARS", digital: 50000, cash: 8000 }]);
  });

  it("adds the settled entries since the opening month to the opening amounts", () => {
    const result = previousBalances("2026-09", OPENING, [
      flow("ARS", "DIGITAL", "income", 20000),
      flow("ARS", "DIGITAL", "expense", 12000),
      flow("ARS", "CASH", "expense", 3000),
    ]);

    expect(result).toEqual([{ currency: "ARS", digital: 58000, cash: 5000 }]);
  });

  it("can drop below zero once the spending outgrows the opening amount", () => {
    const result = previousBalances("2026-07", OPENING, [
      flow("ARS", "CASH", "expense", 9000),
    ]);

    expect(result[0].cash).toBe(-1000);
  });

  it("treats a medium without an opening amount as starting from zero", () => {
    const onlyDigital = opening("2026-06", ["ARS", "DIGITAL", 1000]);
    const result = previousBalances("2026-07", onlyDigital, [
      flow("ARS", "CASH", "income", 700),
    ]);

    expect(result).toEqual([{ currency: "ARS", digital: 1000, cash: 700 }]);
  });

  it("keeps a currency that only has an opening balance, even at zero in the opening month", () => {
    const result = previousBalances(
      "2026-06",
      opening("2026-06", ["USD", "DIGITAL", 0]),
      [],
    );

    expect(result).toEqual([{ currency: "USD", digital: 0, cash: 0 }]);
  });

  it("brings in a currency that only has entries, on top of the opening ones", () => {
    const result = previousBalances("2026-09", OPENING, [
      flow("EUR", "DIGITAL", "income", 300),
    ]);

    expect(result.map((row) => row.currency)).toEqual(["ARS", "EUR"]);
    expect(result[1]).toEqual({ currency: "EUR", digital: 300, cash: 0 });
  });

  it("rolls over a year", () => {
    const result = previousBalances(
      "2027-02",
      opening("2026-11", ["ARS", "DIGITAL", 1000]),
      [flow("ARS", "DIGITAL", "income", 500)],
    );

    expect(result).toEqual([{ currency: "ARS", digital: 1500, cash: 0 }]);
  });
});
