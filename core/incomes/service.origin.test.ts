import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirst: vi.fn(),
  },
  incomeCategory: { findFirst: vi.fn() },
}));
const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import { createIncome, listIncomes, updateIncome } from "./service";
import type { IncomeInput } from "./types";

const { income, incomeCategory } = db;

const USER_ID = "user_123";

const ACCOUNT_ROW = {
  name: "Caja de ahorro",
  bank: { name: "Banco Galicia" },
};

const input: IncomeInput = {
  description: "September salary",
  amount: 1200000,
  currency: "ARS",
  date: "2026-09-01",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: null,
};

const row = {
  id: "inc_1",
  userId: USER_ID,
  description: "September salary",
  amount: BigInt(1200000),
  currency: "ARS",
  date: new Date("2026-09-01T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Salary" },
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  account: ACCOUNT_ROW,
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: null,
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  createdAt: new Date("2026-09-02T10:00:00.000Z"),
  updatedAt: new Date("2026-09-02T10:00:00.000Z"),
};

const withOrigin = {
  ...input,
  originCurrency: "USDC",
  originAmount: 10000000,
};

beforeEach(() => {
  vi.resetAllMocks();
  incomeCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  income.findFirst.mockResolvedValue({ accountId: "acc_1" });
});

describe("createIncome with an origin", () => {
  it("stores the origin currency and its amount as a bigint next to the net amount", async () => {
    income.create.mockResolvedValue({
      ...row,
      originCurrency: "USDC",
      originAmount: BigInt(10000000),
    });

    await createIncome(USER_ID, withOrigin);

    expect(income.create.mock.calls[0][0].data).toMatchObject({
      userId: USER_ID,
      amount: BigInt(1200000),
      currency: "ARS",
      originCurrency: "USDC",
      originAmount: BigInt(10000000),
    });
  });

  it("returns the origin of the stored income", async () => {
    income.create.mockResolvedValue({
      ...row,
      originCurrency: "USDC",
      originAmount: BigInt(10000000),
    });

    await expect(createIncome(USER_ID, withOrigin)).resolves.toMatchObject({
      amount: 1200000,
      originCurrency: "USDC",
      originAmount: 10000000,
    });
  });

  it("stores no origin when there is none", async () => {
    income.create.mockResolvedValue(row);

    await expect(createIncome(USER_ID, input)).resolves.toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
    expect(income.create.mock.calls[0][0].data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });
});

describe("updateIncome and the origin", () => {
  it("sets an origin on an income that had none", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await updateIncome(USER_ID, "inc_1", withOrigin);

    expect(income.updateMany).toHaveBeenCalledWith({
      where: { id: "inc_1", userId: USER_ID },
      data: expect.objectContaining({
        originCurrency: "USDC",
        originAmount: BigInt(10000000),
      }),
    });
  });

  it("clears the origin by writing nulls for both fields", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await updateIncome(USER_ID, "inc_1", input);

    const { data } = income.updateMany.mock.calls[0][0];

    expect(data.originCurrency).toBeNull();
    expect(data.originAmount).toBeNull();
  });
});

describe("listIncomes with an origin", () => {
  it("exposes the origin of every row, with the amount as a number", async () => {
    income.count.mockResolvedValue(2);
    income.findMany.mockResolvedValue([
      { ...row, originCurrency: "USDT", originAmount: BigInt(2500000) },
      row,
    ]);

    const { rows } = await listIncomes(USER_ID);

    expect(rows.map(({ originCurrency }) => originCurrency)).toEqual([
      "USDT",
      null,
    ]);
    expect(rows.map(({ originAmount }) => originAmount)).toEqual([
      2500000,
      null,
    ]);
  });
});
