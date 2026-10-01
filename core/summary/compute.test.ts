import { describe, expect, it } from "vitest";

import { summarize } from "./compute";

const group = (
  currency: string,
  status: "PLANNED" | "SETTLED",
  amount: number | null,
) => ({
  currency,
  status,
  _sum: { amount: amount === null ? null : BigInt(amount) },
});

describe("summarize", () => {
  it("splits incomes and expenses into total, settled and pending", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
    );

    expect(ars.incomes).toEqual({ total: 1400, settled: 1000, pending: 400 });
    expect(ars.expenses).toEqual({ total: 500, settled: 300, pending: 200 });
  });

  it("computes the current remainder from what has actually moved", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
    );

    expect(ars.current).toBe(700);
  });

  it("computes the target remainder as where the month would end if nothing else changes", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
    );

    // 700 now, plus 400 still to collect, minus 200 still to pay.
    expect(ars.target).toBe(900);
  });

  it("equals the current remainder once nothing is pending", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000)],
      [group("ARS", "SETTLED", 300)],
    );

    expect(ars.target).toBe(ars.current);
  });

  it("can leave the expected incomes out of the target remainder", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
      { includeExpectedIncomes: false },
    );

    expect(ars.target).toBe(500);
    expect(ars.current).toBe(700);
  });

  it("includes the expected incomes by default", () => {
    const withDefault = summarize([group("ARS", "PLANNED", 400)], []);
    const explicit = summarize([group("ARS", "PLANNED", 400)], [], {
      includeExpectedIncomes: true,
    });

    expect(withDefault).toEqual(explicit);
    expect(withDefault[0].target).toBe(400);
  });

  it("can go negative when more has gone out than came in", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 100)],
      [group("ARS", "SETTLED", 350)],
    );

    expect(ars.current).toBe(-250);
  });

  it("shows a currency that only has expenses, with zero incomes", () => {
    const [usd] = summarize([], [group("USD", "SETTLED", 500)]);

    expect(usd.incomes).toEqual({ total: 0, settled: 0, pending: 0 });
    expect(usd.expenses).toEqual({ total: 500, settled: 500, pending: 0 });
    expect(usd.current).toBe(-500);
  });

  it("shows a currency that only has incomes, with zero expenses", () => {
    const [eur] = summarize([group("EUR", "PLANNED", 800)], []);

    expect(eur.expenses).toEqual({ total: 0, settled: 0, pending: 0 });
    expect(eur.current).toBe(0);
    expect(eur.target).toBe(800);
  });

  it("keeps every currency apart and sorts them by code", () => {
    const rows = summarize(
      [group("USD", "SETTLED", 10), group("ARS", "SETTLED", 20)],
      [group("EUR", "SETTLED", 5)],
    );

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "EUR", "USD"]);
    expect(rows[0].current).toBe(20);
    expect(rows[1].current).toBe(-5);
    expect(rows[2].current).toBe(10);
  });

  it("ignores groups without a sum", () => {
    const rows = summarize([group("ARS", "SETTLED", null)], []);

    expect(rows).toEqual([]);
  });

  it("returns nothing when there is nothing", () => {
    expect(summarize([], [])).toEqual([]);
  });
});
