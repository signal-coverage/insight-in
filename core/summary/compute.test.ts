import { describe, expect, it } from "vitest";

import { summarize } from "./compute";

const group = (
  currency: string,
  status: "PLANNED" | "SETTLED" | "COVERED",
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

  it("lists the crypto sections after the legal tender ones, each on its own", () => {
    const rows = summarize(
      [
        group("USDC", "SETTLED", 1500000),
        group("ARS", "SETTLED", 20),
        group("BTC", "SETTLED", 1),
      ],
      [group("USD", "SETTLED", 5)],
    );

    expect(rows.map((row) => row.currency)).toEqual([
      "ARS",
      "USD",
      "USDC",
      "BTC",
    ]);
    expect(rows[2].current).toBe(1500000);
    expect(rows[1].current).toBe(-5);
  });

  it("ignores groups without a sum", () => {
    const rows = summarize([group("ARS", "SETTLED", null)], []);

    expect(rows).toEqual([]);
  });

  it("returns nothing when there is nothing", () => {
    expect(summarize([], [])).toEqual([]);
  });
});

describe("summarize with the previous balance", () => {
  const previous = [{ currency: "ARS", amount: 5800 }];

  it("adds the previous balance (every account of the currency) to the current remainder", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000)],
      [group("ARS", "SETTLED", 300)],
      { previous },
    );

    expect(ars.previous).toBe(5800);
    expect(ars.current).toBe(6500);
  });

  it("builds the target from the current remainder and every pending entry", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400)],
      [group("ARS", "PLANNED", 200)],
      { previous },
    );

    expect(ars.target).toBe(6000);
  });

  it("can leave the expected incomes out of the target and still carry the previous balance", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400)],
      [group("ARS", "PLANNED", 200)],
      { previous, includeExpectedIncomes: false },
    );

    expect(ars.target).toBe(5600);
    expect(ars.current).toBe(5800);
  });

  it("gives a currency that only has a previous balance a row of its own", () => {
    const rows = summarize([group("ARS", "SETTLED", 100)], [], {
      previous: [{ currency: "USD", amount: 290 }],
    });

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
    expect(rows[1]).toMatchObject({
      currency: "USD",
      incomes: { total: 0, settled: 0, pending: 0 },
      previous: 290,
      current: 290,
      target: 290,
    });
  });

  it("has no previous balance without any, and no wallet or availability at all", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 100)], []);

    expect(ars.previous).toBe(0);
    expect(ars).not.toHaveProperty("wallet");
    expect(ars).not.toHaveProperty("available");
  });
});

describe("summarize with covered installments", () => {
  const expenses = [
    group("ARS", "SETTLED", 300),
    group("ARS", "PLANNED", 200),
    group("ARS", "COVERED", 900),
  ];

  it("counts a covered expense as neither settled nor pending, nor in the total", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 1000)], expenses);

    expect(ars.expenses).toEqual({ total: 500, settled: 300, pending: 200 });
  });

  it("does not touch the remainders or the target", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 1000)], expenses);

    expect(ars.current).toBe(700);
    expect(ars.target).toBe(500);
  });

  it("gives no row to a currency whose only expenses are covered", () => {
    expect(summarize([], [group("USD", "COVERED", 900)])).toEqual([]);
  });
});

describe("summarize with pending reimbursements", () => {
  it("shows what is still expected back per currency, and zero without any", () => {
    const rows = summarize(
      [group("ARS", "SETTLED", 100)],
      [group("USD", "SETTLED", 100)],
      { reimbursements: [{ currency: "ARS", amount: 400 }] },
    );

    expect(
      rows.map(({ currency, pendingReimbursements }) => [
        currency,
        pendingReimbursements,
      ]),
    ).toEqual([
      ["ARS", 400],
      ["USD", 0],
    ]);
  });

  it("is informational: no remainder moves with it", () => {
    const withIt = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
      { reimbursements: [{ currency: "ARS", amount: 5000 }] },
    );
    const without = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "PLANNED", 400)],
      [group("ARS", "SETTLED", 300), group("ARS", "PLANNED", 200)],
    );

    expect({ ...withIt[0], pendingReimbursements: 0 }).toEqual(without[0]);
  });

  it("does not depend on the switch that adds the incomes still to collect", () => {
    const [ars] = summarize([group("ARS", "PLANNED", 400)], [], {
      includeExpectedIncomes: false,
      reimbursements: [{ currency: "ARS", amount: 700 }],
    });

    expect(ars.pendingReimbursements).toBe(700);
    expect(ars.target).toBe(0);
  });

  it("gives a currency that only has a pending reimbursement a row of its own", () => {
    const rows = summarize([], [], {
      reimbursements: [{ currency: "EUR", amount: 900 }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      currency: "EUR",
      pendingReimbursements: 900,
      incomes: { total: 0, settled: 0, pending: 0 },
      current: 0,
      target: 0,
    });
  });
});
