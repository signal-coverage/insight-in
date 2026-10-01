import { describe, expect, it } from "vitest";

import { toSummaryRows } from "./utils";

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
  current: 70000,
  target: 90000,
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
        current: money("$ 700,00"),
        target: money("$ 900,00"),
      },
    ]);
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
