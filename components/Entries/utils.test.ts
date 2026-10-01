import { describe, expect, it } from "vitest";

import { toTotalRows } from "./utils";

// The es-AR formatter separates the prefix with a no-break space, so a plain space in the
// expectation matches any whitespace.
const money = (text: string) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

  return expect.stringMatching(new RegExp(`^${escaped.replace(/ /g, "\\s")}$`));
};

describe("toTotalRows", () => {
  it("formats the total, the settled part and the pending part of each currency", () => {
    expect(
      toTotalRows([{ currency: "USD", total: 250000, settled: 100000 }]),
    ).toEqual([
      {
        currency: "USD",
        label: money("US$ 2.500,00"),
        settled: money("US$ 1.000,00"),
        pending: money("US$ 1.500,00"),
      },
    ]);
  });

  it("has nothing pending when everything is settled", () => {
    expect(
      toTotalRows([{ currency: "ARS", total: 5000, settled: 5000 }])[0].pending,
    ).toMatch(/0,00/);
  });

  it("keeps every currency apart and in the order it is given", () => {
    const rows = toTotalRows([
      { currency: "ARS", total: 100, settled: 0 },
      { currency: "USD", total: 200, settled: 200 },
    ]);

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
  });
});
