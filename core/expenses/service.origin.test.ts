import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  recurringExpense: { create: vi.fn() },
  recurringExpenseDecision: { create: vi.fn() },
  card: { findFirst: vi.fn() },
  expenseCategory: { findFirst: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  createExpense,
  listExpenses,
  listExpenseTotals,
  updateExpense,
} from "./service";
import type { ExpenseInput } from "./types";

const { expense, expenseCategory, recurringExpense } = db;

const USER_ID = "user_123";

// A 20 USD subscription that really left the user's money as 350,00 ARS.
const input: ExpenseInput = {
  description: "Netflix",
  amount: 35000,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  medium: "DIGITAL",
  isRecurring: false,
  cardId: null,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
};

const withOrigin: ExpenseInput = {
  ...input,
  originCurrency: "USD",
  originAmount: 2000,
};

const row = {
  id: "exp_1",
  userId: USER_ID,
  description: "Netflix",
  amount: BigInt(35000),
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Servicios" },
  notes: null,
  status: "SETTLED",
  medium: "DIGITAL",
  isRecurring: false,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: null,
  recurringExpenseId: null,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  createdAt: new Date("2026-09-06T10:00:00.000Z"),
  updatedAt: new Date("2026-09-06T10:00:00.000Z"),
};

const rowWithOrigin = {
  ...row,
  originCurrency: "USD",
  originAmount: BigInt(2000),
};

beforeEach(() => {
  vi.resetAllMocks();
  expenseCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  db.$transaction.mockImplementation((callback) => callback(db));
});

describe("createExpense with an origin", () => {
  it("stores the origin next to the real amount, as a bigint", async () => {
    expense.create.mockResolvedValue(rowWithOrigin);

    await createExpense(USER_ID, withOrigin);

    expect(expense.create.mock.calls[0][0].data).toMatchObject({
      userId: USER_ID,
      amount: BigInt(35000),
      currency: "ARS",
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });
  });

  it("returns the origin of the stored expense, with the amount as a number", async () => {
    expense.create.mockResolvedValue(rowWithOrigin);

    await expect(createExpense(USER_ID, withOrigin)).resolves.toMatchObject({
      amount: 35000,
      originCurrency: "USD",
      originAmount: 2000,
    });
  });

  it("stores no origin when there is none", async () => {
    expense.create.mockResolvedValue(row);

    await expect(createExpense(USER_ID, input)).resolves.toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
    expect(expense.create.mock.calls[0][0].data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });

  it("copies the origin onto the template an expense saved as recurring creates", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });
    expense.create.mockResolvedValue({ ...rowWithOrigin, isRecurring: true });

    await createExpense(USER_ID, { ...withOrigin, isRecurring: true });

    expect(recurringExpense.create.mock.calls[0][0].data).toMatchObject({
      amount: BigInt(35000),
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });
    expect(expense.create.mock.calls[0][0].data).toMatchObject({
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });
  });

  it("gives the template no origin when the expense has none", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });
    expense.create.mockResolvedValue({ ...row, isRecurring: true });

    await createExpense(USER_ID, { ...input, isRecurring: true });

    expect(recurringExpense.create.mock.calls[0][0].data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });
});

describe("updateExpense and the origin", () => {
  beforeEach(() => {
    expense.findFirst.mockResolvedValue({
      recurringExpenseId: null,
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
    });
    expense.updateMany.mockResolvedValue({ count: 1 });
  });

  it("sets an origin on an expense that had none", async () => {
    await updateExpense(USER_ID, "exp_1", withOrigin);

    expect(expense.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "exp_1", userId: USER_ID },
      data: { originCurrency: "USD", originAmount: BigInt(2000) },
    });
  });

  it("clears the origin by writing nulls for both fields", async () => {
    await updateExpense(USER_ID, "exp_1", input);

    const { data } = expense.updateMany.mock.calls[0][0];

    expect(data.originCurrency).toBeNull();
    expect(data.originAmount).toBeNull();
  });

  it("copies the origin onto the template an edited expense becomes", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });

    await updateExpense(USER_ID, "exp_1", {
      ...withOrigin,
      isRecurring: true,
    });

    expect(recurringExpense.create.mock.calls[0][0].data).toMatchObject({
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });
  });

  it("leaves the template of an expense that already has one untouched", async () => {
    expense.findFirst.mockResolvedValue({
      recurringExpenseId: "rec_1",
      installmentPlanId: null,
      currency: "ARS",
      expectedReimbursement: null,
    });

    await updateExpense(USER_ID, "exp_1", {
      ...withOrigin,
      isRecurring: true,
    });

    expect(recurringExpense.create).not.toHaveBeenCalled();
  });
});

describe("listExpenses with an origin", () => {
  it("exposes the origin of every row, with the amount as a number", async () => {
    expense.count.mockResolvedValue(2);
    expense.findMany.mockResolvedValue([rowWithOrigin, row]);

    const { rows } = await listExpenses(USER_ID);

    expect(rows.map(({ originCurrency }) => originCurrency)).toEqual([
      "USD",
      null,
    ]);
    expect(rows.map(({ originAmount }) => originAmount)).toEqual([2000, null]);
  });
});

describe("the totals of expenses with an origin", () => {
  it("count the real amount only: the reference price never enters the sum", async () => {
    expense.groupBy.mockResolvedValue([
      {
        currency: "ARS",
        status: "SETTLED",
        _sum: { amount: BigInt(35000) },
      },
    ]);

    const totals = await listExpenseTotals(USER_ID);

    expect(expense.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["currency", "status"],
        _sum: { amount: true },
      }),
    );
    expect(totals).toEqual([
      expect.objectContaining({ currency: "ARS", settled: 35000 }),
    ]);
  });
});
