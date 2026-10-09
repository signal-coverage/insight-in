import { describe, expect, it } from "vitest";

import { rateEvolution, summarizePairs } from "./compute";
import type { ConversionEntry } from "./types";

let sequence = 0;

// USDC has 6 decimals and ARS 2: 1000 USDC is 1_000_000_000 minor units, ARS 1.200.000 is 120_000_000.
const entry = (
  overrides: Partial<ConversionEntry> & {
    date: string;
    amount: number;
    originAmount: number;
  },
): ConversionEntry => {
  sequence += 1;

  return {
    id: `entry_${sequence}`,
    description: "Cobro",
    currency: "ARS",
    originCurrency: "USDC",
    ...overrides,
  };
};

const usdc = (units: number) => units * 1_000_000;
const ars = (units: number) => units * 100;

describe("summarizePairs", () => {
  it("orders the pairs by the registry order of the crypto origins, not alphabetically", () => {
    const entries = ["DAI", "USDT", "USDC"].map((originCurrency) =>
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
        originCurrency,
      }),
    );

    expect(
      summarizePairs(entries, "income", "2026-09").map(
        (pair) => pair.originCurrency,
      ),
    ).toEqual(["USDC", "USDT", "DAI"]);
  });

  it("keeps legal tender first, by code, then the crypto", () => {
    const entries = ["USDC", "USD", "EUR"].map((originCurrency) =>
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: 1000,
        originCurrency,
      }),
    );

    expect(
      summarizePairs(entries, "income", "2026-09").map(
        (pair) => pair.originCurrency,
      ),
    ).toEqual(["EUR", "USD", "USDC"]);
  });

  it("returns nothing when no entry belongs to the month", () => {
    const entries = [
      entry({
        date: "2026-08-10",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
    ];

    expect(summarizePairs(entries, "income", "2026-09")).toEqual([]);
  });

  it("counts the conversions and totals what was sent and what arrived, per pair", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-20",
        amount: ars(660_000),
        originAmount: usdc(500),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair).toMatchObject({
      side: "income",
      originCurrency: "USDC",
      netCurrency: "ARS",
      count: 2,
      totalOrigin: usdc(1500),
      totalNet: ars(1_860_000),
    });
  });

  it("averages the rate weighted by amount, not as the mean of the rates", () => {
    // 1200 per USDC on 1000 and 1320 per USDC on 500: weighted 1240, plain mean 1260.
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-20",
        amount: ars(660_000),
        originAmount: usdc(500),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair.averageRate).toBeCloseTo(1240, 6);
  });

  it("takes the highest rate as the best one of an income, with its date", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-20",
        amount: ars(660_000),
        originAmount: usdc(500),
      }),
      entry({
        date: "2026-09-25",
        amount: ars(1_100_000),
        originAmount: usdc(1000),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair.best).toEqual({ rate: 1320, date: "2026-09-20" });
    expect(pair.worst).toEqual({ rate: 1100, date: "2026-09-25" });
  });

  it("takes the lowest rate as the best one of an expense, since paying less for the same price is better", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        currency: "ARS",
        originCurrency: "USD",
        amount: ars(35_000),
        originAmount: 20_00,
      }),
      entry({
        date: "2026-09-12",
        currency: "ARS",
        originCurrency: "USD",
        amount: ars(38_000),
        originAmount: 20_00,
      }),
    ];

    const [pair] = summarizePairs(entries, "expense", "2026-09");

    expect(pair.best).toEqual({ rate: 1750, date: "2026-09-05" });
    expect(pair.worst).toEqual({ rate: 1900, date: "2026-09-12" });
  });

  it("takes the latest conversion of the month as the last rate, whatever order the entries come in", () => {
    const entries = [
      entry({
        date: "2026-09-25",
        amount: ars(1_100_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair.last).toEqual({ rate: 1100, date: "2026-09-25" });
  });

  it("repeats the single rate as best, worst and last when there is one conversion", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");
    const point = { rate: 1200, date: "2026-09-05" };

    expect(pair.best).toEqual(point);
    expect(pair.worst).toEqual(point);
    expect(pair.last).toEqual(point);
    expect(pair.averageRate).toBeCloseTo(1200, 6);
  });

  it("lists every conversion of the month, newest first, with its own rate", () => {
    const entries = [
      entry({
        id: "a",
        date: "2026-09-05",
        description: "Sueldo",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        id: "b",
        date: "2026-09-20",
        description: "Extra",
        amount: ars(660_000),
        originAmount: usdc(500),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair.items).toEqual([
      {
        id: "b",
        date: "2026-09-20",
        description: "Extra",
        originAmount: usdc(500),
        netAmount: ars(660_000),
        rate: 1320,
      },
      {
        id: "a",
        date: "2026-09-05",
        description: "Sueldo",
        originAmount: usdc(1000),
        netAmount: ars(1_200_000),
        rate: 1200,
      },
    ]);
  });

  it("never mixes pairs: another origin or another net currency is a section of its own", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-06",
        originCurrency: "USDT",
        amount: ars(600_000),
        originAmount: usdc(500),
      }),
      entry({
        date: "2026-09-07",
        currency: "EUR",
        originCurrency: "USDC",
        amount: 90_000,
        originAmount: usdc(100),
      }),
    ];

    const pairs = summarizePairs(entries, "income", "2026-09");

    expect(
      pairs.map(({ originCurrency, netCurrency }) => [
        originCurrency,
        netCurrency,
      ]),
    ).toEqual([
      ["USDC", "ARS"],
      ["USDC", "EUR"],
      ["USDT", "ARS"],
    ]);
    expect(pairs.map(({ count }) => count)).toEqual([1, 1, 1]);
  });

  it("ignores entries that cannot have a rate (an unknown currency or a zero amount)", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        originCurrency: "XYZ",
        amount: ars(100),
        originAmount: 100,
      }),
      entry({ date: "2026-09-06", amount: ars(100), originAmount: 0 }),
      entry({
        date: "2026-09-07",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
    ];

    const pairs = summarizePairs(entries, "income", "2026-09");

    expect(pairs).toHaveLength(1);
    expect(pairs[0].count).toBe(1);
  });

  it("only looks at the month asked for", () => {
    const entries = [
      entry({
        date: "2026-08-31",
        amount: ars(1_000_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-09-01",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
      entry({
        date: "2026-10-01",
        amount: ars(1_400_000),
        originAmount: usdc(1000),
      }),
    ];

    const [pair] = summarizePairs(entries, "income", "2026-09");

    expect(pair.count).toBe(1);
    expect(pair.averageRate).toBeCloseTo(1200, 6);
  });

  it("tags every pair with the side it was built for", () => {
    const entries = [
      entry({
        date: "2026-09-05",
        amount: ars(1_200_000),
        originAmount: usdc(1000),
      }),
    ];

    expect(summarizePairs(entries, "expense", "2026-09")[0].side).toBe(
      "expense",
    );
  });
});

describe("rateEvolution", () => {
  const monthly = (month: string, netUnits: number, originUnits: number) =>
    entry({
      date: `${month}-10`,
      amount: ars(netUnits),
      originAmount: usdc(originUnits),
    });

  it("returns nothing when there is no data in the last six months", () => {
    const entries = [monthly("2026-02", 1_000_000, 1000)];

    expect(rateEvolution(entries, "income", "2026-09")).toEqual([]);
  });

  it("gives the weighted rate of each month, oldest first, with the variation against the month before", () => {
    const entries = [
      monthly("2026-07", 1_000_000, 1000),
      monthly("2026-08", 1_100_000, 1000),
      // Two conversions in September: 1200 and 1320 weigh in as 1240.
      monthly("2026-09", 1_200_000, 1000),
      monthly("2026-09", 660_000, 500),
    ];

    const [pair] = rateEvolution(entries, "income", "2026-09");

    expect(pair.side).toBe("income");
    expect(pair.originCurrency).toBe("USDC");
    expect(pair.netCurrency).toBe("ARS");
    expect(pair.points.map(({ month }) => month)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    expect(pair.points[0]).toMatchObject({ rate: 1000, variation: null });
    expect(pair.points[1].rate).toBeCloseTo(1100, 6);
    expect(pair.points[1].variation).toBeCloseTo(10, 6);
    expect(pair.points[2].rate).toBeCloseTo(1240, 6);
    expect(pair.points[2].variation).toBeCloseTo(
      ((1240 - 1100) / 1100) * 100,
      6,
    );
  });

  it("covers six months ending at the one viewed, including it", () => {
    const entries = [
      monthly("2026-03", 1_000_000, 1000),
      monthly("2026-04", 1_000_000, 1000),
      monthly("2026-09", 1_000_000, 1000),
      monthly("2026-10", 1_000_000, 1000),
    ];

    const [pair] = rateEvolution(entries, "income", "2026-09");

    // March falls before the window, April is its first month and October comes after it.
    expect(pair.points.map(({ month }) => month)).toEqual([
      "2026-04",
      "2026-09",
    ]);
  });

  it("leaves the variation empty when the month before has no data, instead of comparing across a gap", () => {
    const entries = [
      monthly("2026-06", 1_000_000, 1000),
      monthly("2026-09", 1_200_000, 1000),
    ];

    const [pair] = rateEvolution(entries, "income", "2026-09");

    expect(pair.points.map(({ variation }) => variation)).toEqual([null, null]);
  });

  it("keeps a pair apart from the others and from the other side", () => {
    const entries = [
      monthly("2026-09", 1_200_000, 1000),
      entry({
        date: "2026-09-12",
        originCurrency: "USDT",
        amount: ars(600_000),
        originAmount: usdc(500),
      }),
    ];

    const pairs = rateEvolution(entries, "income", "2026-09");

    expect(pairs.map(({ originCurrency }) => originCurrency)).toEqual([
      "USDC",
      "USDT",
    ]);
    expect(rateEvolution(entries, "expense", "2026-09")[0].side).toBe(
      "expense",
    );
  });

  it("includes a pair that has data in the window but not in the month viewed", () => {
    const entries = [monthly("2026-07", 1_000_000, 1000)];

    expect(rateEvolution(entries, "income", "2026-09")).toHaveLength(1);
  });
});
