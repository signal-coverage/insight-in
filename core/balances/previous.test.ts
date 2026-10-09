import { describe, expect, it } from "vitest";

import { previousAccountBalances, totalsByCurrency } from "./accounts";
import { previousBalances, priorEntriesWindow } from "./previous";
import type { AccountFlow, OpeningBalances } from "./types";

const flow = (
  currency: string,
  kind: AccountFlow["kind"],
  amount: number,
  accountId = `acc_${currency}`,
): AccountFlow => ({ accountId, currency, kind, amount });

const opening = (
  month: string,
  ...amounts: [string, number, string?][]
): OpeningBalances => ({
  month,
  amounts: amounts.map(([currency, amount, accountId = `acc_${currency}`]) => ({
    accountId,
    currency,
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
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 10000),
        flow("ARS", "expense", 3500),
      ]),
    ).toEqual([{ currency: "ARS", amount: 6500 }]);
  });

  it("keeps currencies apart and sorted by code", () => {
    const result = previousBalances("2026-09", null, [
      flow("USD", "income", 100),
      flow("ARS", "income", 200),
    ]);

    expect(result.map((row) => row.currency)).toEqual(["ARS", "USD"]);
  });

  it("can be negative when more went out than came in", () => {
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 1000),
        flow("ARS", "expense", 4000),
      ])[0].amount,
    ).toBe(-3000);
  });

  it("leaves out a currency whose balance is zero", () => {
    expect(
      previousBalances("2026-09", null, [
        flow("ARS", "income", 1000),
        flow("ARS", "expense", 1000),
      ]),
    ).toEqual([]);
  });

  it("is empty when nothing came before", () => {
    expect(previousBalances("2026-09", null, [])).toEqual([]);
  });
});

describe("previousBalances with an opening balance", () => {
  const OPENING = opening(
    "2026-06",
    ["ARS", 50000, "acc_bank"],
    ["ARS", 8000, "acc_cash"],
  );

  it("is zero before the opening month: it does not apply there, and nothing is invented", () => {
    expect(
      previousBalances("2026-05", OPENING, [flow("ARS", "income", 999)]),
    ).toEqual([]);
  });

  it("is the sum of the opening amounts of the currency in the opening month (cash is just money)", () => {
    expect(
      previousBalances("2026-06", OPENING, [flow("ARS", "income", 999)]),
    ).toEqual([{ currency: "ARS", amount: 58000 }]);
  });

  it("adds the settled entries since the opening month to the opening amounts", () => {
    expect(
      previousBalances("2026-09", OPENING, [
        flow("ARS", "income", 20000),
        flow("ARS", "expense", 15000),
      ]),
    ).toEqual([{ currency: "ARS", amount: 63000 }]);
  });

  it("keeps a currency that only has an opening balance, even at zero in the opening month", () => {
    expect(
      previousBalances("2026-06", opening("2026-06", ["USD", 0]), []),
    ).toEqual([{ currency: "USD", amount: 0 }]);
  });

  it("brings in a currency that only has entries, on top of the opening ones", () => {
    const result = previousBalances("2026-09", OPENING, [
      flow("EUR", "income", 300),
    ]);

    expect(result).toEqual([
      { currency: "ARS", amount: 58000 },
      { currency: "EUR", amount: 300 },
    ]);
  });

  it("rolls over a year", () => {
    expect(
      previousBalances("2027-02", opening("2026-11", ["ARS", 1000]), [
        flow("ARS", "income", 500),
      ]),
    ).toEqual([{ currency: "ARS", amount: 1500 }]);
  });

  it("can drop below zero once the spending outgrows the opening amount", () => {
    expect(
      previousBalances("2026-07", OPENING, [flow("ARS", "expense", 59000)]),
    ).toEqual([{ currency: "ARS", amount: -1000 }]);
  });
});

describe("previousBalances is the sum of the accounts", () => {
  it("adds the previous balance of every account of the currency", () => {
    expect(
      previousBalances(
        "2026-09",
        opening(
          "2026-06",
          ["ARS", 50000, "acc_bank"],
          ["ARS", 8000, "acc_cash"],
        ),
        [
          flow("ARS", "income", 20000, "acc_bank"),
          flow("ARS", "expense", 9000, "acc_cash"),
        ],
      ),
    ).toEqual([{ currency: "ARS", amount: 69000 }]);
  });

  it("equals totalsByCurrency of previousAccountBalances, for any mix of accounts", () => {
    const OPENING = opening(
      "2026-06",
      ["ARS", 1000, "a"],
      ["ARS", 0, "b"],
      ["USD", 300, "c"],
    );
    const FLOWS = [
      flow("ARS", "income", 700, "a"),
      flow("ARS", "expense", 1200, "b"),
      flow("USD", "expense", 50, "c"),
      flow("EUR", "income", 10, "d"),
    ];

    expect(previousBalances("2026-08", OPENING, FLOWS)).toEqual(
      totalsByCurrency(previousAccountBalances("2026-08", OPENING, FLOWS)),
    );
  });
});
