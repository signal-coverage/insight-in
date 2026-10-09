import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  income: { groupBy: vi.fn(), count: vi.fn() },
  recurringExpense: { create: vi.fn() },
  recurringExpenseDecision: { create: vi.fn() },
  expenseCategory: { findFirst: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import {
  ExpenseCurrencyLockedError,
  ReimbursementLockedError,
} from "@/core/reimbursements/errors";

import { createExpense, listExpenses, updateExpense } from "./service";
import type { ExpenseInput } from "./types";

const { expense, income, recurringExpense } = db;

const USER_ID = "user_123";
const ACCOUNT_ROW = {
  name: "Caja de ahorro",
  bank: { name: "Banco Galicia" },
};

const input: ExpenseInput = {
  description: "Dentista",
  amount: 1000000,
  currency: "ARS",
  date: "2026-09-12",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  isRecurring: false,
  cardId: null,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: 400000,
};

const row = {
  id: "exp_1",
  userId: USER_ID,
  description: "Dentista",
  amount: BigInt(1000000),
  currency: "ARS",
  date: new Date("2026-09-12T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Salud" },
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  account: ACCOUNT_ROW,
  isRecurring: false,
  originCurrency: null,
  originAmount: null,
  expectedReimbursement: BigInt(400000),
  recurringExpenseId: null,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  createdAt: new Date("2026-09-12T10:00:00.000Z"),
  updatedAt: new Date("2026-09-12T10:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  db.expenseCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  db.$transaction.mockImplementation((callback) => callback(db));
  income.groupBy.mockResolvedValue([]);
});

describe("createExpense with an expected reimbursement", () => {
  it("stores it as a bigint next to the real amount", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(expense.create.mock.calls[0][0].data).toMatchObject({
      amount: BigInt(1000000),
      expectedReimbursement: BigInt(400000),
    });
  });

  it("stores null when none is expected", async () => {
    expense.create.mockResolvedValue({ ...row, expectedReimbursement: null });

    await createExpense(USER_ID, { ...input, expectedReimbursement: null });

    expect(
      expense.create.mock.calls[0][0].data.expectedReimbursement,
    ).toBeNull();
  });

  it("never copies it onto the template an expense saved as recurring creates", async () => {
    recurringExpense.create.mockResolvedValue({ id: "rec_1" });
    expense.create.mockResolvedValue({ ...row, isRecurring: true });

    await createExpense(USER_ID, { ...input, isRecurring: true });

    expect(recurringExpense.create.mock.calls[0][0].data).not.toHaveProperty(
      "expectedReimbursement",
    );
  });
});

describe("updateExpense and the expected reimbursement", () => {
  const current = {
    recurringExpenseId: null,
    installmentPlanId: null,
    currency: "ARS",
    expectedReimbursement: BigInt(400000),
    accountId: "acc_1",
    cardId: null,
    amount: BigInt(1000000),
    date: new Date("2026-09-12T00:00:00.000Z"),
    status: "SETTLED",
  };

  beforeEach(() => {
    expense.findFirst.mockResolvedValue(current);
    expense.updateMany.mockResolvedValue({ count: 1 });
    income.count.mockResolvedValue(0);
  });

  it("changes it", async () => {
    await updateExpense(USER_ID, "exp_1", {
      ...input,
      expectedReimbursement: 500000,
    });

    expect(expense.updateMany.mock.calls[0][0].data.expectedReimbursement).toBe(
      BigInt(500000),
    );
  });

  it("clears it by writing null", async () => {
    await updateExpense(USER_ID, "exp_1", {
      ...input,
      expectedReimbursement: null,
    });

    expect(
      expense.updateMany.mock.calls[0][0].data.expectedReimbursement,
    ).toBeNull();
  });

  it("refuses to change the currency of an expense with incomes linked to it", async () => {
    income.count.mockResolvedValue(1);

    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, currency: "USD" }),
    ).rejects.toBeInstanceOf(ExpenseCurrencyLockedError);
    expect(income.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, reimbursesExpenseId: "exp_1" },
    });
    expect(expense.updateMany).not.toHaveBeenCalled();
  });

  it("changes the currency of an expense nothing is linked to", async () => {
    await expect(
      updateExpense(USER_ID, "exp_1", { ...input, currency: "USD" }),
    ).resolves.toBe(true);
  });

  it("refuses to stop expecting a reimbursement while incomes are linked to it", async () => {
    income.count.mockResolvedValue(2);

    await expect(
      updateExpense(USER_ID, "exp_1", {
        ...input,
        expectedReimbursement: null,
      }),
    ).rejects.toBeInstanceOf(ReimbursementLockedError);
    expect(expense.updateMany).not.toHaveBeenCalled();
  });

  it("looks for linked incomes only when the currency or the clearing needs it", async () => {
    await updateExpense(USER_ID, "exp_1", input);

    expect(income.count).not.toHaveBeenCalled();
  });

  it("answers false for an expense that belongs to somebody else, before anything else", async () => {
    expense.findFirst.mockResolvedValue(null);

    await expect(updateExpense(USER_ID, "exp_9", input)).resolves.toBe(false);
    expect(income.count).not.toHaveBeenCalled();
  });
});

describe("listExpenses and the reimbursements", () => {
  it("exposes what is expected and what the linked incomes add up to, in one grouped query", async () => {
    expense.count.mockResolvedValue(2);
    expense.findMany.mockResolvedValue([
      row,
      { ...row, id: "exp_2", expectedReimbursement: null },
    ]);
    income.groupBy.mockResolvedValue([
      { reimbursesExpenseId: "exp_1", _sum: { amount: BigInt(150000) } },
    ]);

    const { rows } = await listExpenses(USER_ID);

    expect(
      rows.map(({ expectedReimbursement, reimbursementReceived }) => [
        expectedReimbursement,
        reimbursementReceived,
      ]),
    ).toEqual([
      [400000, 150000],
      [null, 0],
    ]);
    expect(income.groupBy).toHaveBeenCalledTimes(1);
    expect(income.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      reimbursesExpenseId: { in: ["exp_1"] },
    });
  });

  it("reads no incomes when no row expects a reimbursement", async () => {
    expense.count.mockResolvedValue(1);
    expense.findMany.mockResolvedValue([
      { ...row, expectedReimbursement: null },
    ]);

    await listExpenses(USER_ID);

    expect(income.groupBy).not.toHaveBeenCalled();
  });
});
