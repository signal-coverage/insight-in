import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn(), findMany: vi.fn() },
  openingBalance: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { getMonthlySummary } from "./service";

const USER_ID = "user_123";

const monthGroup = (
  currency: string,
  status: "SETTLED" | "PLANNED" | "COVERED",
  medium: "DIGITAL" | "CASH",
  amount: number,
) => ({ currency, status, medium, _sum: { amount: BigInt(amount) } });

const priorGroup = (
  currency: string,
  medium: "DIGITAL" | "CASH",
  amount: number,
) => ({ currency, medium, _sum: { amount: BigInt(amount) } });

const openingRow = (
  currency: string,
  medium: "DIGITAL" | "CASH",
  amount: number,
  month: string,
) => ({ currency, medium, amount: BigInt(amount), month });

// The first call of each table reads the month itself; the second, when there is one, reads the
// settled entries before it.
const monthCall = (table: "income" | "expense") =>
  db[table].groupBy.mock.calls[0][0];
const priorCall = (table: "income" | "expense") =>
  db[table].groupBy.mock.calls[1]?.[0];

beforeEach(() => {
  vi.resetAllMocks();
  db.income.groupBy.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
  db.expense.findMany.mockResolvedValue([]);
  db.openingBalance.findMany.mockResolvedValue([]);
});

describe("getMonthlySummary", () => {
  it("groups the user's incomes and expenses of that month by currency, status and medium", async () => {
    await getMonthlySummary(USER_ID, "2026-09");

    const where = {
      userId: USER_ID,
      date: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T00:00:00.000Z"),
      },
    };

    expect(db.income.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status", "medium"],
      where,
      _sum: { amount: true },
    });
    expect(db.expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status", "medium"],
      where,
      _sum: { amount: true },
    });
  });

  it("sums only the real amount of the expenses: the reference price of one quoted in another currency never enters", async () => {
    // A 20 USD subscription that cost 35.000 ARS is just 35.000 ARS to the month.
    db.expense.groupBy.mockResolvedValue([
      monthGroup("ARS", "SETTLED", "DIGITAL", 3500000),
    ]);

    const summary = await getMonthlySummary(USER_ID, "2026-09");

    expect(monthCall("expense")._sum).toEqual({ amount: true });
    expect(monthCall("expense").by).not.toContain("originCurrency");
    expect(JSON.stringify(monthCall("expense").where)).not.toContain("origin");
    expect(summary.find(({ currency }) => currency === "ARS")).toMatchObject({
      expenses: expect.objectContaining({ settled: 3500000 }),
    });
  });

  it("never reaches another user's rows: the owner leads every filter", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("ARS", "DIGITAL", 100, "2026-01"),
    ]);

    await getMonthlySummary(USER_ID, "2026-02");

    expect(db.openingBalance.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });

    for (const table of ["income", "expense"] as const) {
      expect(monthCall(table).where.userId).toBe(USER_ID);
      expect(priorCall(table).where.userId).toBe(USER_ID);
    }
  });

  it("counts the installments of a loan repaid in cuotas like any other income: no filter looks at the plan", async () => {
    await getMonthlySummary(USER_ID, "2026-09");

    for (const call of [monthCall("income")]) {
      expect(Object.keys(call.where).sort()).toEqual(["date", "userId"]);
    }
  });

  it("counts an income that came from another currency by its net amount only: the origin is never read", async () => {
    // 12.000,00 ARS arrived out of 10 USDC: the database sums the net column, grouped by the net
    // currency, so the origin can neither be added to a total nor open a group of its own.
    db.income.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "SETTLED", "DIGITAL", 1200000),
    ]);

    const [ars, ...others] = await getMonthlySummary(USER_ID, "2026-09");

    expect(ars.currency).toBe("ARS");
    expect(ars.incomes.total).toBe(1200000);
    expect(others).toEqual([]);

    for (const call of db.income.groupBy.mock.calls) {
      expect(JSON.stringify(call[0])).not.toContain("origin");
      expect(call[0]._sum).toEqual({ amount: true });
    }
  });

  it("turns a collected installment into collected money and a planned one into money still to collect", async () => {
    db.income.groupBy.mockResolvedValueOnce([
      // The monthly income of the loan: one installment collected, another still to come.
      monthGroup("ARS", "SETTLED", "DIGITAL", 50000),
      monthGroup("ARS", "PLANNED", "DIGITAL", 50000),
    ]);

    const [ars] = await getMonthlySummary(USER_ID, "2026-09");

    expect(ars.incomes).toEqual({
      total: 100000,
      settled: 50000,
      pending: 50000,
    });
    expect(ars.current).toBe(50000);
    expect(ars.target).toBe(100000);
  });

  it("includes the last day of the month, whatever its length", async () => {
    await getMonthlySummary(USER_ID, "2028-02");

    expect(monthCall("income").where.date.lte).toEqual(
      new Date("2028-02-29T00:00:00.000Z"),
    );
  });

  it("turns what the database returns into the summary", async () => {
    db.income.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "SETTLED", "DIGITAL", 100000),
      monthGroup("ARS", "PLANNED", "DIGITAL", 40000),
    ]);
    db.expense.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "SETTLED", "DIGITAL", 30000),
    ]);

    await expect(getMonthlySummary(USER_ID, "2026-09")).resolves.toEqual([
      {
        currency: "ARS",
        incomes: { total: 140000, settled: 100000, pending: 40000 },
        expenses: { total: 30000, settled: 30000, pending: 0 },
        previous: 0,
        current: 70000,
        target: 110000,
        wallet: 0,
        available: 70000,
        pendingReimbursements: 0,
      },
    ]);
  });

  it("leaves the installments covered by someone else out of every figure of the summary", async () => {
    db.income.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "SETTLED", "DIGITAL", 100000),
    ]);
    db.expense.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "SETTLED", "DIGITAL", 30000),
      monthGroup("ARS", "PLANNED", "DIGITAL", 20000),
      monthGroup("ARS", "COVERED", "DIGITAL", 50000),
      monthGroup("ARS", "COVERED", "CASH", 7000),
    ]);

    await expect(getMonthlySummary(USER_ID, "2026-09")).resolves.toEqual([
      {
        currency: "ARS",
        incomes: { total: 100000, settled: 100000, pending: 0 },
        expenses: { total: 50000, settled: 30000, pending: 20000 },
        previous: 0,
        current: 70000,
        target: 50000,
        wallet: 0,
        available: 70000,
        pendingReimbursements: 0,
      },
    ]);
  });

  it("only carries over what was settled from the earlier months, so a covered installment never moves the balance", async () => {
    await getMonthlySummary(USER_ID, "2026-09");

    expect(priorCall("expense").where.status).toBe("SETTLED");
  });

  it("can leave the expected incomes out of the target remainder", async () => {
    db.income.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "PLANNED", "DIGITAL", 40000),
    ]);

    const [row] = await getMonthlySummary(USER_ID, "2026-09", {
      includeExpectedIncomes: false,
    });

    expect(row.target).toBe(0);
  });

  it("returns nothing for a month with no entries and nothing before it", async () => {
    await expect(getMonthlySummary(USER_ID, "2026-09")).resolves.toEqual([]);
  });
});

describe("getMonthlySummary pending reimbursements", () => {
  it("shows what is still expected back, per currency, next to the month's figures", async () => {
    db.expense.findMany.mockResolvedValue([
      { id: "exp_1", currency: "ARS", expectedReimbursement: BigInt(1000000) },
    ]);
    // The linked incomes of the expense: 4.000,00 already came back.
    db.income.groupBy.mockImplementation(({ by }) =>
      Promise.resolve(
        by[0] === "reimbursesExpenseId"
          ? [{ reimbursesExpenseId: "exp_1", _sum: { amount: BigInt(400000) } }]
          : [],
      ),
    );

    const [ars] = await getMonthlySummary(USER_ID, "2026-09");

    expect(ars.currency).toBe("ARS");
    expect(ars.pendingReimbursements).toBe(600000);
  });

  it("is informational: the target remainder is the same with and without it", async () => {
    db.income.groupBy.mockResolvedValueOnce([
      monthGroup("ARS", "PLANNED", "DIGITAL", 40000),
    ]);
    db.expense.findMany.mockResolvedValue([
      { id: "exp_1", currency: "ARS", expectedReimbursement: BigInt(1000000) },
    ]);

    const [row] = await getMonthlySummary(USER_ID, "2026-09", {
      includeExpectedIncomes: false,
    });

    expect(row.target).toBe(0);
    expect(row.pendingReimbursements).toBe(1000000);
  });

  it("reads only the user's own rows, up to the last day of the viewed month", async () => {
    db.expense.findMany.mockResolvedValue([
      { id: "exp_1", currency: "ARS", expectedReimbursement: BigInt(1000) },
    ]);

    await getMonthlySummary(USER_ID, "2026-09");

    expect(db.expense.findMany.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      expectedReimbursement: { not: null },
      date: { lte: new Date("2026-09-30T00:00:00.000Z") },
    });

    const linked = db.income.groupBy.mock.calls
      .map(([query]) => query)
      .find(({ by }) => by[0] === "reimbursesExpenseId");

    expect(linked.where.userId).toBe(USER_ID);
    expect(linked.where.date).toEqual({
      lte: new Date("2026-09-30T00:00:00.000Z"),
    });
  });
});

describe("getMonthlySummary previous balance", () => {
  it("without an opening balance, adds up every settled entry before the month", async () => {
    await getMonthlySummary(USER_ID, "2026-09");

    for (const table of ["income", "expense"] as const) {
      expect(priorCall(table)).toEqual({
        by: ["currency", "medium"],
        where: {
          userId: USER_ID,
          status: "SETTLED",
          date: { lte: new Date("2026-08-31T00:00:00.000Z") },
        },
        _sum: { amount: true },
      });
    }
  });

  it("with an opening balance, adds up only from the first day of its month", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("ARS", "DIGITAL", 100, "2026-06"),
    ]);

    await getMonthlySummary(USER_ID, "2026-09");

    expect(priorCall("income").where.date).toEqual({
      gte: new Date("2026-06-01T00:00:00.000Z"),
      lte: new Date("2026-08-31T00:00:00.000Z"),
    });
  });

  it("reads nothing before the opening month, nor in it: no balance applies there", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("ARS", "DIGITAL", 100, "2026-06"),
    ]);

    await getMonthlySummary(USER_ID, "2026-06");
    await getMonthlySummary(USER_ID, "2026-05");

    // Two calls per table: one month read each time and no prior read.
    expect(db.income.groupBy).toHaveBeenCalledTimes(2);
    expect(db.expense.groupBy).toHaveBeenCalledTimes(2);
  });

  it("feeds the remainders with the digital part and the wallet with the cash part", async () => {
    db.income.groupBy
      .mockResolvedValueOnce([monthGroup("ARS", "SETTLED", "CASH", 500)])
      .mockResolvedValueOnce([
        priorGroup("ARS", "DIGITAL", 10000),
        priorGroup("ARS", "CASH", 2000),
      ]);
    db.expense.groupBy
      .mockResolvedValueOnce([monthGroup("ARS", "SETTLED", "DIGITAL", 300)])
      .mockResolvedValueOnce([
        priorGroup("ARS", "DIGITAL", 4000),
        priorGroup("ARS", "CASH", 500),
      ]);

    const [row] = await getMonthlySummary(USER_ID, "2026-09");

    expect(row.previous).toBe(6000);
    expect(row.current).toBe(5700);
    expect(row.wallet).toBe(2000);
    expect(row.available).toBe(7700);
  });

  it("starts from the opening amounts and adds what happened since", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("ARS", "DIGITAL", 50000, "2026-06"),
      openingRow("ARS", "CASH", 8000, "2026-06"),
    ]);
    db.income.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([priorGroup("ARS", "DIGITAL", 20000)]);
    db.expense.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([priorGroup("ARS", "CASH", 3000)]);

    const [row] = await getMonthlySummary(USER_ID, "2026-09");

    expect(row.previous).toBe(70000);
    expect(row.wallet).toBe(5000);
  });

  it("gives a section to a currency that only has a previous balance", async () => {
    db.income.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([priorGroup("USD", "DIGITAL", 25000)]);

    const rows = await getMonthlySummary(USER_ID, "2026-09");

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      currency: "USD",
      previous: 25000,
      current: 25000,
      available: 25000,
    });
  });

  it("gives a section to a currency that only has an opening balance", async () => {
    db.openingBalance.findMany.mockResolvedValue([
      openingRow("EUR", "CASH", 900, "2026-09"),
    ]);

    const rows = await getMonthlySummary(USER_ID, "2026-09");

    expect(rows).toMatchObject([{ currency: "EUR", wallet: 900 }]);
  });
});
