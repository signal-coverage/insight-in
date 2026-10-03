import { describe, expect, it } from "vitest";

import { summarize } from "./compute";

const group = (
  currency: string,
  status: "PLANNED" | "SETTLED" | "COVERED",
  amount: number | null,
  medium: "DIGITAL" | "CASH" = "DIGITAL",
) => ({
  currency,
  status,
  medium,
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

describe("summarize with payment mediums", () => {
  const previous = [{ currency: "ARS", digital: 5000, cash: 800 }];

  it("counts cash and digital entries together in the incomes and expenses rows", () => {
    const [ars] = summarize(
      [
        group("ARS", "SETTLED", 1000, "DIGITAL"),
        group("ARS", "SETTLED", 200, "CASH"),
        group("ARS", "PLANNED", 400, "CASH"),
      ],
      [
        group("ARS", "SETTLED", 300, "DIGITAL"),
        group("ARS", "SETTLED", 50, "CASH"),
      ],
    );

    expect(ars.incomes).toEqual({ total: 1600, settled: 1200, pending: 400 });
    expect(ars.expenses).toEqual({ total: 350, settled: 350, pending: 0 });
  });

  it("adds the digital previous balance to the current remainder", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000)],
      [group("ARS", "SETTLED", 300)],
      { previous },
    );

    expect(ars.previous).toBe(5000);
    expect(ars.current).toBe(5700);
  });

  it("builds the current remainder only from digital entries: cash does not touch it", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "SETTLED", 700, "CASH")],
      [group("ARS", "SETTLED", 300), group("ARS", "SETTLED", 100, "CASH")],
    );

    expect(ars.current).toBe(700);
  });

  it("builds the target from the current remainder and the pending digital entries", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400), group("ARS", "PLANNED", 999, "CASH")],
      [group("ARS", "PLANNED", 200), group("ARS", "PLANNED", 888, "CASH")],
      { previous },
    );

    // 5000 before, plus 400 still to collect, minus 200 still to pay: pending cash is left out.
    expect(ars.target).toBe(5200);
  });

  it("can leave the expected incomes out of the target and still carry the previous balance", () => {
    const [ars] = summarize(
      [group("ARS", "PLANNED", 400)],
      [group("ARS", "PLANNED", 200)],
      { previous, includeExpectedIncomes: false },
    );

    expect(ars.target).toBe(4800);
    expect(ars.current).toBe(5000);
  });

  it("computes the wallet as the cash previous balance plus the settled cash movements", () => {
    const [ars] = summarize(
      [
        group("ARS", "SETTLED", 200, "CASH"),
        group("ARS", "PLANNED", 900, "CASH"),
      ],
      [
        group("ARS", "SETTLED", 50, "CASH"),
        group("ARS", "PLANNED", 70, "CASH"),
      ],
      { previous },
    );

    // 800 + 200 - 50: planned cash has not moved yet.
    expect(ars.wallet).toBe(950);
  });

  it("leaves digital entries out of the wallet", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000)],
      [group("ARS", "SETTLED", 300)],
    );

    expect(ars.wallet).toBe(0);
  });

  it("computes the total available as the current remainder plus the wallet", () => {
    const [ars] = summarize(
      [group("ARS", "SETTLED", 1000), group("ARS", "SETTLED", 200, "CASH")],
      [group("ARS", "SETTLED", 300), group("ARS", "SETTLED", 50, "CASH")],
      { previous },
    );

    expect(ars.current).toBe(5700);
    expect(ars.wallet).toBe(950);
    expect(ars.available).toBe(6650);
  });

  it("can have a negative wallet", () => {
    const [ars] = summarize([], [group("ARS", "SETTLED", 300, "CASH")]);

    expect(ars.wallet).toBe(-300);
    expect(ars.available).toBe(-300 + ars.current);
  });

  it("gives a currency that only has a previous balance a row of its own", () => {
    const rows = summarize([group("ARS", "SETTLED", 100)], [], {
      previous: [{ currency: "USD", digital: 250, cash: 40 }],
    });

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
    expect(rows[1]).toMatchObject({
      currency: "USD",
      incomes: { total: 0, settled: 0, pending: 0 },
      previous: 250,
      current: 250,
      wallet: 40,
      available: 290,
    });
  });

  it("has no previous balance, wallet or availability without any", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 100)], []);

    expect(ars.previous).toBe(0);
    expect(ars.wallet).toBe(0);
    expect(ars.available).toBe(100);
  });
});

describe("summarize with covered installments", () => {
  const expenses = [
    group("ARS", "SETTLED", 300),
    group("ARS", "PLANNED", 200),
    group("ARS", "COVERED", 900),
    group("ARS", "COVERED", 700, "CASH"),
  ];

  it("counts a covered expense as neither settled nor pending, nor in the total", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 1000)], expenses);

    expect(ars.expenses).toEqual({ total: 500, settled: 300, pending: 200 });
  });

  it("does not touch the remainders, the target, the wallet or the availability", () => {
    const [ars] = summarize([group("ARS", "SETTLED", 1000)], expenses);

    expect(ars.current).toBe(700);
    expect(ars.target).toBe(500);
    expect(ars.wallet).toBe(0);
    expect(ars.available).toBe(700);
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

  it("is informational: no remainder, wallet or availability moves with it", () => {
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
