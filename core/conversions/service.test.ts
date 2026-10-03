import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { findMany: vi.fn() },
  expense: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { getConversions } from "./service";

const USER_ID = "user_123";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: "row_1",
  date: new Date("2026-09-05T00:00:00.000Z"),
  description: "Sueldo",
  amount: BigInt(120_000_000),
  currency: "ARS",
  originCurrency: "USDC",
  originAmount: BigInt(1_000_000_000),
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.income.findMany.mockResolvedValue([]);
  db.expense.findMany.mockResolvedValue([]);
});

describe("getConversions", () => {
  it("makes one ranged query per table, six months back from the end of the viewed month", async () => {
    await getConversions(USER_ID, "2026-09");

    expect(db.income.findMany).toHaveBeenCalledTimes(1);
    expect(db.expense.findMany).toHaveBeenCalledTimes(1);

    const { where } = db.income.findMany.mock.calls[0][0];

    expect(where.date).toEqual({
      gte: new Date("2026-04-01T00:00:00.000Z"),
      lte: new Date("2026-09-30T00:00:00.000Z"),
    });
    expect(db.expense.findMany.mock.calls[0][0].where.date).toEqual(where.date);
  });

  it("only reads the user's own rows that carry an origin and moved money: the owner leads the filter", async () => {
    await getConversions(USER_ID, "2026-09");

    for (const table of ["income", "expense"] as const) {
      const { where } = db[table].findMany.mock.calls[0][0];

      expect(Object.keys(where)[0]).toBe("userId");
      expect(where).toMatchObject({
        userId: USER_ID,
        status: "SETTLED",
        originCurrency: { not: null },
        originAmount: { not: null },
      });
    }
  });

  it("selects only the fields the statistics need", async () => {
    await getConversions(USER_ID, "2026-09");

    expect(db.income.findMany.mock.calls[0][0].select).toEqual({
      id: true,
      date: true,
      description: true,
      amount: true,
      currency: true,
      originCurrency: true,
      originAmount: true,
    });
  });

  it("reads the earlier months with the same two queries, so a year change needs no extra one", async () => {
    await getConversions(USER_ID, "2026-02");

    expect(db.income.findMany.mock.calls[0][0].where.date.gte).toEqual(
      new Date("2025-09-01T00:00:00.000Z"),
    );
    expect(db.income.findMany).toHaveBeenCalledTimes(1);
  });

  it("builds the month's incomes per pair with their weighted rate", async () => {
    db.income.findMany.mockResolvedValue([
      row({ id: "a" }),
      row({
        id: "b",
        date: new Date("2026-09-20T00:00:00.000Z"),
        amount: BigInt(66_000_000),
        originAmount: BigInt(500_000_000),
      }),
    ]);

    const { incomes, expenses } = await getConversions(USER_ID, "2026-09");

    expect(expenses).toEqual([]);
    expect(incomes).toHaveLength(1);
    expect(incomes[0]).toMatchObject({
      side: "income",
      originCurrency: "USDC",
      netCurrency: "ARS",
      count: 2,
    });
    expect(incomes[0].averageRate).toBeCloseTo(1240, 6);
  });

  it("keeps the expenses on their own side", async () => {
    db.expense.findMany.mockResolvedValue([
      row({
        id: "e1",
        description: "Suscripción",
        amount: BigInt(3_500_000),
        originCurrency: "USD",
        originAmount: BigInt(2000),
      }),
    ]);

    const { incomes, expenses } = await getConversions(USER_ID, "2026-09");

    expect(incomes).toEqual([]);
    expect(expenses[0]).toMatchObject({
      side: "expense",
      originCurrency: "USD",
      netCurrency: "ARS",
      count: 1,
    });
    expect(expenses[0].averageRate).toBeCloseTo(1750, 6);
  });

  it("leaves the months before the viewed one out of the statistics but in the evolution", async () => {
    db.income.findMany.mockResolvedValue([
      row({
        id: "old",
        date: new Date("2026-08-10T00:00:00.000Z"),
        amount: BigInt(110_000_000),
      }),
      row({ id: "now" }),
    ]);

    const { incomes, evolution } = await getConversions(USER_ID, "2026-09");

    expect(incomes[0].count).toBe(1);
    expect(evolution).toHaveLength(1);
    expect(evolution[0].points.map(({ month }) => month)).toEqual([
      "2026-08",
      "2026-09",
    ]);
    expect(evolution[0].points[1].variation).toBeCloseTo(
      ((1200 - 1100) / 1100) * 100,
      6,
    );
  });

  it("skips a row whose origin is half filled in, whatever the database says", async () => {
    db.income.findMany.mockResolvedValue([
      row({ originAmount: null }),
      row({ id: "ok" }),
    ]);

    const { incomes } = await getConversions(USER_ID, "2026-09");

    expect(incomes[0].count).toBe(1);
  });

  it("rejects when the database fails", async () => {
    db.income.findMany.mockRejectedValue(new Error("database down"));

    await expect(getConversions(USER_ID, "2026-09")).rejects.toThrow(
      "database down",
    );
  });
});
