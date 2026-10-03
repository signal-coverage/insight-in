import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  expense: { findFirst: vi.fn(), findMany: vi.fn() },
  income: { groupBy: vi.fn(), count: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  ReimbursedExpenseNotFoundError,
  ReimbursementCurrencyMismatchError,
  ReimbursementNotExpectedError,
} from "./errors";
import {
  assertReimbursable,
  countLinkedIncomes,
  getPendingReimbursements,
  listReceivedTotals,
  listReimbursableExpenses,
} from "./service";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  db.expense.findMany.mockResolvedValue([]);
  db.income.groupBy.mockResolvedValue([]);
});

describe("assertReimbursable", () => {
  it("looks the expense up among the user's own, owner first", async () => {
    db.expense.findFirst.mockResolvedValue({
      currency: "ARS",
      expectedReimbursement: BigInt(1000),
    });

    await assertReimbursable(USER_ID, "exp_1", "ARS");

    expect(db.expense.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, id: "exp_1" },
      select: { currency: true, expectedReimbursement: true },
    });
  });

  it("rejects an expense that is not the user's or does not exist", async () => {
    db.expense.findFirst.mockResolvedValue(null);

    await expect(
      assertReimbursable(USER_ID, "exp_9", "ARS"),
    ).rejects.toBeInstanceOf(ReimbursedExpenseNotFoundError);
  });

  it("rejects an expense that expects no reimbursement", async () => {
    db.expense.findFirst.mockResolvedValue({
      currency: "ARS",
      expectedReimbursement: null,
    });

    await expect(
      assertReimbursable(USER_ID, "exp_1", "ARS"),
    ).rejects.toBeInstanceOf(ReimbursementNotExpectedError);
  });

  it("rejects an expense in another currency", async () => {
    db.expense.findFirst.mockResolvedValue({
      currency: "USD",
      expectedReimbursement: BigInt(1000),
    });

    await expect(
      assertReimbursable(USER_ID, "exp_1", "ARS"),
    ).rejects.toBeInstanceOf(ReimbursementCurrencyMismatchError);
  });
});

describe("countLinkedIncomes", () => {
  it("counts the user's incomes linked to the expense", async () => {
    db.income.count.mockResolvedValue(2);

    await expect(countLinkedIncomes(USER_ID, "exp_1")).resolves.toBe(2);
    expect(db.income.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, reimbursesExpenseId: "exp_1" },
    });
  });
});

describe("listReceivedTotals", () => {
  it("reads nothing for no expenses", async () => {
    await expect(listReceivedTotals(USER_ID, [])).resolves.toEqual([]);
    expect(db.income.groupBy).not.toHaveBeenCalled();
  });

  it("sums the linked incomes of every expense in one grouped query, of any status", async () => {
    db.income.groupBy.mockResolvedValue([
      { reimbursesExpenseId: "a", _sum: { amount: BigInt(400000) } },
      { reimbursesExpenseId: null, _sum: { amount: BigInt(1) } },
    ]);

    await expect(listReceivedTotals(USER_ID, ["a", "b"])).resolves.toEqual([
      { expenseId: "a", amount: 400000 },
    ]);

    const query = db.income.groupBy.mock.calls[0][0];

    expect(query.by).toEqual(["reimbursesExpenseId"]);
    expect(query.where).toEqual({
      userId: USER_ID,
      reimbursesExpenseId: { in: ["a", "b"] },
    });
    expect(query.where).not.toHaveProperty("status");
  });
});

describe("getPendingReimbursements", () => {
  it("reads the user's expenses with an expected reimbursement up to the last day of the month", async () => {
    await getPendingReimbursements(USER_ID, "2026-09");

    expect(db.expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        expectedReimbursement: { not: null },
        date: { lte: new Date("2026-09-30T00:00:00.000Z") },
      },
      select: { id: true, currency: true, expectedReimbursement: true },
    });
  });

  it("reads nothing else when no expense expects a reimbursement", async () => {
    await expect(getPendingReimbursements(USER_ID, "2026-09")).resolves.toEqual(
      [],
    );
    expect(db.income.groupBy).not.toHaveBeenCalled();
  });

  it("counts only the linked incomes dated up to that day, owner first, so past months stay consistent", async () => {
    db.expense.findMany.mockResolvedValue([
      { id: "a", currency: "ARS", expectedReimbursement: BigInt(1000000) },
    ]);

    await getPendingReimbursements(USER_ID, "2028-02");

    expect(db.income.groupBy).toHaveBeenCalledTimes(1);
    expect(db.income.groupBy).toHaveBeenCalledWith({
      by: ["reimbursesExpenseId"],
      where: {
        userId: USER_ID,
        reimbursesExpenseId: { in: ["a"] },
        date: { lte: new Date("2028-02-29T00:00:00.000Z") },
      },
      _sum: { amount: true },
    });
  });

  it("returns what is outstanding per currency, collected or not", async () => {
    db.expense.findMany.mockResolvedValue([
      { id: "a", currency: "ARS", expectedReimbursement: BigInt(1000000) },
      { id: "b", currency: "USD", expectedReimbursement: BigInt(20000) },
    ]);
    db.income.groupBy.mockResolvedValue([
      { reimbursesExpenseId: "a", _sum: { amount: BigInt(400000) } },
    ]);

    await expect(getPendingReimbursements(USER_ID, "2026-09")).resolves.toEqual(
      [
        { currency: "ARS", amount: 600000 },
        { currency: "USD", amount: 20000 },
      ],
    );
  });
});

describe("listReimbursableExpenses", () => {
  it("offers the user's expenses that still have something outstanding, newest first", async () => {
    db.expense.findMany.mockResolvedValue([
      {
        id: "a",
        description: "Dentista",
        date: new Date("2026-09-12T00:00:00.000Z"),
        currency: "ARS",
        expectedReimbursement: BigInt(1000000),
      },
      {
        id: "b",
        description: "Préstamo",
        date: new Date("2026-08-01T00:00:00.000Z"),
        currency: "ARS",
        expectedReimbursement: BigInt(500000),
      },
    ]);
    db.income.groupBy.mockResolvedValue([
      { reimbursesExpenseId: "a", _sum: { amount: BigInt(600000) } },
      { reimbursesExpenseId: "b", _sum: { amount: BigInt(500000) } },
    ]);

    await expect(listReimbursableExpenses(USER_ID)).resolves.toEqual([
      {
        id: "a",
        description: "Dentista",
        date: "2026-09-12",
        currency: "ARS",
        outstanding: 400000,
      },
    ]);
    expect(db.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, expectedReimbursement: { not: null } },
        orderBy: [{ date: "desc" }, { id: "desc" }],
      }),
    );
  });
});
