import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn() },
  expense: { groupBy: vi.fn() },
  expenseCategory: { findMany: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { readMonthChartSources } from "./charts";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.income.groupBy.mockResolvedValue([]);
  db.expense.groupBy.mockResolvedValue([]);
  db.expenseCategory.findMany.mockResolvedValue([]);
});

describe("readMonthChartSources", () => {
  it("groups the user's planned and settled incomes and expenses of the six months that end with the month, by currency, day and status", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    const query = {
      by: ["currency", "date", "status"],
      where: {
        userId: USER_ID,
        status: { in: ["PLANNED", "SETTLED"] },
        date: {
          gte: new Date("2026-04-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
      },
      _sum: { amount: true },
    };

    expect(db.income.groupBy).toHaveBeenCalledWith(query);
    expect(db.expense.groupBy).toHaveBeenCalledWith(query);
  });

  it("groups the month's planned and settled expenses by currency and category", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    expect(db.expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "categoryId"],
      where: {
        userId: USER_ID,
        status: { in: ["PLANNED", "SETTLED"] },
        date: {
          gte: new Date("2026-09-01T00:00:00.000Z"),
          lte: new Date("2026-09-30T00:00:00.000Z"),
        },
      },
      _sum: { amount: true },
    });
    expect(db.expense.groupBy).toHaveBeenCalledTimes(2);
  });

  // The categories must add up to Gastos Total (PLANNED + SETTLED, as the month totals fold it), so the
  // read leaves COVERED out: the positive twin is that both money statuses are asked for.
  it("excludes covered expenses from the category read and keeps both money statuses", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    const categoryCall = db.expense.groupBy.mock.calls.find(([query]) =>
      query.by.includes("categoryId"),
    );

    expect(categoryCall).toBeDefined();

    const statuses = categoryCall?.[0].where.status.in;

    expect(statuses).toContain("PLANNED");
    expect(statuses).toContain("SETTLED");
    expect(statuses).not.toContain("COVERED");
  });

  it("reads only the user's own category names", async () => {
    await readMonthChartSources(USER_ID, "2026-09");

    expect(db.expenseCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      select: { id: true, name: true },
    });
  });

  it("hands back what it read, as it came", async () => {
    const income = {
      currency: "ARS",
      date: new Date("2026-09-02T00:00:00.000Z"),
      status: "SETTLED",
      _sum: { amount: BigInt(1000) },
    };
    const byCategory = {
      currency: "ARS",
      categoryId: "cat_food",
      _sum: { amount: BigInt(300) },
    };

    db.income.groupBy.mockResolvedValue([income]);
    // The series read first, the categories second (the order of the calls in the code).
    db.expense.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([byCategory]);
    db.expenseCategory.findMany.mockResolvedValue([
      { id: "cat_food", name: "Comida" },
    ]);

    await expect(readMonthChartSources(USER_ID, "2026-09")).resolves.toEqual({
      incomes: [income],
      expenses: [],
      categories: [byCategory],
      categoryNames: [{ id: "cat_food", name: "Comida" }],
    });
  });

  it("rejects when a read fails, so the loader can isolate the charts", async () => {
    db.expenseCategory.findMany.mockRejectedValue(new Error("database down"));

    await expect(readMonthChartSources(USER_ID, "2026-09")).rejects.toThrow(
      "database down",
    );
  });
});
