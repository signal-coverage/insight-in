import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { getMonthlySummary } from "./service";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.income.groupBy.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
});

describe("getMonthlySummary", () => {
  it("groups the user's incomes and expenses of that month by currency and status", async () => {
    await getMonthlySummary(USER_ID, "2026-09");

    const where = {
      userId: USER_ID,
      date: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lte: new Date("2026-09-30T00:00:00.000Z"),
      },
    };

    expect(db.income.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status"],
      where,
      _sum: { amount: true },
    });
    expect(db.expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status"],
      where,
      _sum: { amount: true },
    });
  });

  it("never reaches another user's rows: the owner leads the filter on both tables", async () => {
    await getMonthlySummary(USER_ID, "2026-02");

    expect(db.income.groupBy.mock.calls[0][0].where.userId).toBe(USER_ID);
    expect(db.expense.groupBy.mock.calls[0][0].where.userId).toBe(USER_ID);
  });

  it("includes the last day of the month, whatever its length", async () => {
    await getMonthlySummary(USER_ID, "2028-02");

    expect(db.income.groupBy.mock.calls[0][0].where.date.lte).toEqual(
      new Date("2028-02-29T00:00:00.000Z"),
    );
  });

  it("turns what the database returns into the summary", async () => {
    db.income.groupBy.mockResolvedValue([
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(40000) } },
    ]);
    db.expense.groupBy.mockResolvedValue([
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(30000) } },
    ]);

    await expect(getMonthlySummary(USER_ID, "2026-09")).resolves.toEqual([
      {
        currency: "ARS",
        incomes: { total: 140000, settled: 100000, pending: 40000 },
        expenses: { total: 30000, settled: 30000, pending: 0 },
        current: 70000,
        target: 110000,
      },
    ]);
  });

  it("can leave the expected incomes out of the target remainder", async () => {
    db.income.groupBy.mockResolvedValue([
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(40000) } },
    ]);

    const [row] = await getMonthlySummary(USER_ID, "2026-09", {
      includeExpectedIncomes: false,
    });

    expect(row.target).toBe(0);
  });

  it("returns nothing for a month with no entries", async () => {
    await expect(getMonthlySummary(USER_ID, "2026-09")).resolves.toEqual([]);
  });
});
