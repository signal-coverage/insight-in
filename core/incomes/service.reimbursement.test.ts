import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  incomeCategory: { findFirst: vi.fn() },
}));
const reimbursements = vi.hoisted(() => ({ assertReimbursable: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/reimbursements/service", () => reimbursements);

import { ReimbursementCurrencyMismatchError } from "@/core/reimbursements/errors";

import { createIncome, listIncomes, updateIncome } from "./service";
import type { IncomeInput } from "./types";

const { income, incomeCategory } = db;

const USER_ID = "user_123";

const input: IncomeInput = {
  description: "Reintegro obra social",
  amount: 600000,
  currency: "ARS",
  date: "2026-09-20",
  categoryId: "cat_1",
  notes: null,
  status: "PLANNED",
  medium: "DIGITAL",
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: "exp_1",
};

const row = {
  id: "inc_1",
  userId: USER_ID,
  description: "Reintegro obra social",
  amount: BigInt(600000),
  currency: "ARS",
  date: new Date("2026-09-20T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Otros" },
  notes: null,
  status: "PLANNED",
  medium: "DIGITAL",
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: "exp_1",
  reimbursesExpense: { description: "Dentista" },
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  createdAt: new Date("2026-09-20T10:00:00.000Z"),
  updatedAt: new Date("2026-09-20T10:00:00.000Z"),
};

beforeEach(() => {
  vi.resetAllMocks();
  incomeCategory.findFirst.mockResolvedValue({ id: "cat_1" });
  reimbursements.assertReimbursable.mockResolvedValue(undefined);
});

describe("createIncome that pays an expense back", () => {
  it("checks the expense belongs to the user, expects a reimbursement and is in the currency of the income", async () => {
    income.create.mockResolvedValue(row);

    await createIncome(USER_ID, input);

    expect(reimbursements.assertReimbursable).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      "ARS",
    );
  });

  it("writes nothing when the expense does not qualify", async () => {
    reimbursements.assertReimbursable.mockRejectedValue(
      new ReimbursementCurrencyMismatchError(),
    );

    await expect(createIncome(USER_ID, input)).rejects.toBeInstanceOf(
      ReimbursementCurrencyMismatchError,
    );
    expect(income.create).not.toHaveBeenCalled();
  });

  it("links the income to the expense, whatever the status of the income", async () => {
    income.create.mockResolvedValue(row);

    await createIncome(USER_ID, input);

    expect(income.create.mock.calls[0][0].data).toMatchObject({
      userId: USER_ID,
      status: "PLANNED",
      reimbursesExpenseId: "exp_1",
    });
  });

  it("returns the link and the description of the expense it pays back", async () => {
    income.create.mockResolvedValue(row);

    await expect(createIncome(USER_ID, input)).resolves.toMatchObject({
      reimbursesExpenseId: "exp_1",
      reimbursesExpenseDescription: "Dentista",
    });
  });

  it("does not look any expense up for an ordinary income", async () => {
    income.create.mockResolvedValue({
      ...row,
      reimbursesExpenseId: null,
      reimbursesExpense: null,
    });

    await expect(
      createIncome(USER_ID, { ...input, reimbursesExpenseId: null }),
    ).resolves.toMatchObject({
      reimbursesExpenseId: null,
      reimbursesExpenseDescription: null,
    });
    expect(reimbursements.assertReimbursable).not.toHaveBeenCalled();
    expect(income.create.mock.calls[0][0].data.reimbursesExpenseId).toBeNull();
  });
});

describe("updateIncome and the expense it pays back", () => {
  beforeEach(() => {
    income.updateMany.mockResolvedValue({ count: 1 });
  });

  it("checks the new expense before writing", async () => {
    await updateIncome(USER_ID, "inc_1", input);

    expect(reimbursements.assertReimbursable).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      "ARS",
    );
    expect(income.updateMany.mock.calls[0][0]).toMatchObject({
      where: { id: "inc_1", userId: USER_ID },
      data: { reimbursesExpenseId: "exp_1" },
    });
  });

  it("checks it against the currency the income is saved with", async () => {
    await updateIncome(USER_ID, "inc_1", { ...input, currency: "USD" });

    expect(reimbursements.assertReimbursable).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      "USD",
    );
  });

  it("unlinks it by writing null", async () => {
    await updateIncome(USER_ID, "inc_1", {
      ...input,
      reimbursesExpenseId: null,
    });

    expect(reimbursements.assertReimbursable).not.toHaveBeenCalled();
    expect(
      income.updateMany.mock.calls[0][0].data.reimbursesExpenseId,
    ).toBeNull();
  });

  it("writes nothing when the expense does not qualify", async () => {
    reimbursements.assertReimbursable.mockRejectedValue(
      new ReimbursementCurrencyMismatchError(),
    );

    await expect(updateIncome(USER_ID, "inc_1", input)).rejects.toBeInstanceOf(
      ReimbursementCurrencyMismatchError,
    );
    expect(income.updateMany).not.toHaveBeenCalled();
  });
});

describe("listIncomes and the expense it pays back", () => {
  it("brings the description of that expense in the same query", async () => {
    income.count.mockResolvedValue(2);
    income.findMany.mockResolvedValue([
      row,
      {
        ...row,
        id: "inc_2",
        reimbursesExpenseId: null,
        reimbursesExpense: null,
      },
    ]);

    const { rows } = await listIncomes(USER_ID);

    expect(income.findMany.mock.calls[0][0].include).toEqual({
      category: { select: { name: true } },
      reimbursesExpense: { select: { description: true } },
    });
    expect(
      rows.map(({ reimbursesExpenseId, reimbursesExpenseDescription }) => [
        reimbursesExpenseId,
        reimbursesExpenseDescription,
      ]),
    ).toEqual([
      ["exp_1", "Dentista"],
      [null, null],
    ]);
  });
});
