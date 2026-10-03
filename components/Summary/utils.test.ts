import { describe, expect, it } from "vitest";

import { toOpeningBalanceData, toSummaryRows } from "./utils";

// The es-AR formatter separates the prefix with a no-break space, so a plain space in the
// expectation matches any whitespace.
const money = (text: string) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

  return expect.stringMatching(new RegExp(`^${escaped.replace(/ /g, "\\s")}$`));
};

const ARS = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 70000,
  target: 90000,
  wallet: 25000,
  available: 95000,
  pendingReimbursements: 400000,
};

describe("toSummaryRows", () => {
  it("formats every amount in its own currency", () => {
    expect(toSummaryRows([ARS])).toEqual([
      {
        currency: "ARS",
        incomes: {
          total: money("$ 1.400,00"),
          settled: money("$ 1.000,00"),
          pending: money("$ 400,00"),
        },
        expenses: {
          total: money("$ 500,00"),
          settled: money("$ 300,00"),
          pending: money("$ 200,00"),
        },
        previous: money("$ 5.000,00"),
        current: money("$ 700,00"),
        target: money("$ 900,00"),
        wallet: money("$ 250,00"),
        available: money("$ 950,00"),
        reimbursements: money("$ 4.000,00"),
      },
    ]);
  });

  it("formats a negative wallet and a negative total with their sign", () => {
    const [row] = toSummaryRows([{ ...ARS, wallet: -1500, available: -1000 }]);

    expect(row.wallet).toMatch(/-/);
    expect(row.wallet).toMatch(/15,00/);
    expect(row.available).toMatch(/-/);
  });

  it("formats a negative remainder with its sign", () => {
    const [row] = toSummaryRows([{ ...ARS, current: -25000, target: -5000 }]);

    expect(row.current).toMatch(/-/);
    expect(row.current).toMatch(/250,00/);
  });

  it("keeps the order and the currencies it is given", () => {
    const rows = toSummaryRows([ARS, { ...ARS, currency: "USD" }]);

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
    expect(rows[1].incomes.total).toMatch(/US\$/);
  });

  it("returns nothing for nothing", () => {
    expect(toSummaryRows([])).toEqual([]);
  });
});

describe("toOpeningBalanceData", () => {
  it("starts every currency empty when nothing was saved", () => {
    expect(
      toOpeningBalanceData({ opening: null, currencies: ["ARS", "USD"] }),
    ).toEqual({
      month: null,
      rows: [
        { currency: "ARS", digital: "", cash: "" },
        { currency: "USD", digital: "", cash: "" },
      ],
    });
  });

  it("prefills the saved amounts as plain decimal text, with the month they are valid from", () => {
    expect(
      toOpeningBalanceData({
        opening: {
          month: "2026-06",
          amounts: [
            { currency: "ARS", medium: "DIGITAL", amount: 500050 },
            { currency: "ARS", medium: "CASH", amount: 80000 },
            { currency: "USD", medium: "CASH", amount: 12025 },
          ],
        },
        currencies: ["ARS", "USD"],
      }),
    ).toEqual({
      month: "2026-06",
      rows: [
        { currency: "ARS", digital: "5000.50", cash: "800.00" },
        { currency: "USD", digital: "", cash: "120.25" },
      ],
    });
  });

  it("keeps an explicit zero as a zero, not as an empty field", () => {
    const { rows } = toOpeningBalanceData({
      opening: {
        month: "2026-06",
        amounts: [{ currency: "ARS", medium: "DIGITAL", amount: 0 }],
      },
      currencies: ["ARS"],
    });

    expect(rows[0].digital).toBe("0.00");
    expect(rows[0].cash).toBe("");
  });

  it("keeps the order of the currencies it is given", () => {
    const { rows } = toOpeningBalanceData({
      opening: null,
      currencies: ["ARS", "EUR", "USD"],
    });

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "EUR", "USD"]);
  });
});
