import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  expense: {
    findMany: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  expenseCategory: { findFirst: vi.fn() },
  recurringExpense: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  recurringExpenseDecision: { upsert: vi.fn() },
}));

const usable = vi.hoisted(() => ({ assertUsableAccount: vi.fn() }));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));
vi.mock("@/core/accounts/usable", () => usable);

import { AccountArchivedError } from "@/core/accounts/errors";
import { CategoryNotFoundError } from "@/core/incomes/errors";

import { RecurringExpenseSettledError, RecurringNotFoundError } from "./errors";
import {
  removeRecurringExpense,
  setRecurringDecision,
  updateRecurringExpense,
} from "./recurringService";
import type { RecurringExpenseInput } from "./types";

const { expense, recurringExpense, recurringExpenseDecision } = db;

const USER_ID = "user_123";
const MONTH = "2026-10";

const templateRow = (patch: Record<string, unknown> = {}) => ({
  id: "rec_1",
  userId: USER_ID,
  description: "Rent",
  amount: BigInt(35000050),
  currency: "ARS",
  categoryId: "cat_1",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  ...patch,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  recurringExpense.findFirst.mockResolvedValue(templateRow());
  recurringExpense.updateMany.mockResolvedValue({ count: 1 });
  recurringExpense.deleteMany.mockResolvedValue({ count: 1 });
  expense.findMany.mockResolvedValue([]);
  expense.createMany.mockResolvedValue({ count: 1 });
  expense.deleteMany.mockResolvedValue({ count: 1 });
  expense.updateMany.mockResolvedValue({ count: 0 });
  recurringExpenseDecision.upsert.mockResolvedValue({});
  db.expenseCategory.findFirst.mockResolvedValue({ id: "cat_2" });
});

const decisionUpsert = (decision: "ENABLED" | "DISABLED") => ({
  where: {
    recurringExpenseId_month: { recurringExpenseId: "rec_1", month: MONTH },
  },
  create: { recurringExpenseId: "rec_1", month: MONTH, decision },
  update: { decision },
});

describe("setRecurringDecision: enable", () => {
  const enable = () => setRecurringDecision(USER_ID, "rec_1", MONTH, "ENABLED");

  it("creates the month's pending expense from the template, on its day, linked to it", async () => {
    await enable();

    expect(expense.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          description: "Rent",
          amount: BigInt(35000050),
          currency: "ARS",
          categoryId: "cat_1",
          notes: null,
          accountId: "acc_1",
          originCurrency: null,
          originAmount: null,
          date: new Date("2026-10-05T00:00:00.000Z"),
          status: "PLANNED",
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("creates the month's expense in the template's account", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ accountId: "acc_cash" }),
    );
    expense.findMany.mockResolvedValue([]);

    await setRecurringDecision(USER_ID, "rec_1", MONTH, "ENABLED");

    expect(expense.createMany.mock.calls[0][0].data[0].accountId).toBe(
      "acc_cash",
    );
  });

  it("creates the expense in the template's account even if that account was archived since, without checking it again", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ accountId: "acc_archived" }),
    );
    // The account guard would refuse an archived account: it must not be asked.
    usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

    await enable();

    expect(expense.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: USER_ID,
          description: "Rent",
          amount: BigInt(35000050),
          currency: "ARS",
          categoryId: "cat_1",
          notes: null,
          accountId: "acc_archived",
          originCurrency: null,
          originAmount: null,
          date: new Date("2026-10-05T00:00:00.000Z"),
          status: "PLANNED",
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
      ],
      skipDuplicates: true,
    });
    expect(usable.assertUsableAccount).not.toHaveBeenCalled();
  });

  it("copies the reference price of the template onto the expense", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ originCurrency: "USD", originAmount: BigInt(2000) }),
    );

    await enable();

    expect(expense.createMany.mock.calls[0][0].data[0]).toMatchObject({
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });
  });

  it("uses the last day of a month that is too short for the template's day", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ dayOfMonth: 31 }),
    );

    await setRecurringDecision(USER_ID, "rec_1", "2026-02", "ENABLED");

    expect(expense.createMany.mock.calls[0][0].data[0].date).toEqual(
      new Date("2026-02-28T00:00:00.000Z"),
    );
  });

  it("records the enabled decision for the month", async () => {
    await enable();

    expect(recurringExpenseDecision.upsert).toHaveBeenCalledWith(
      decisionUpsert("ENABLED"),
    );
  });

  it("looks for the month's expense of that template only, scoped to the user", async () => {
    await enable();

    expect(expense.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        recurringExpenseId: "rec_1",
        date: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lte: new Date("2026-10-31T00:00:00.000Z"),
        },
      },
      select: { id: true, status: true },
    });
  });

  it("does not create a second expense when the month already has one, and only records the decision", async () => {
    expense.findMany.mockResolvedValue([{ id: "exp_1", status: "SETTLED" }]);

    await enable();

    expect(expense.createMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).toHaveBeenCalledWith(
      decisionUpsert("ENABLED"),
    );
  });

  it("does the expense and the decision in one transaction", async () => {
    await enable();

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("is idempotent: enabling again with the expense there changes nothing but the (same) decision", async () => {
    await enable();
    expense.findMany.mockResolvedValue([{ id: "exp_new", status: "PLANNED" }]);
    await enable();

    expect(expense.createMany).toHaveBeenCalledTimes(1);
    expect(recurringExpenseDecision.upsert).toHaveBeenCalledTimes(2);
  });
});

describe("setRecurringDecision: disable", () => {
  const disable = () =>
    setRecurringDecision(USER_ID, "rec_1", MONTH, "DISABLED");

  it("deletes the month's expense while it is still pending, and records the decision", async () => {
    expense.findMany.mockResolvedValue([{ id: "exp_1", status: "PLANNED" }]);

    await disable();

    expect(expense.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["exp_1"] }, userId: USER_ID, status: "PLANNED" },
    });
    expect(recurringExpenseDecision.upsert).toHaveBeenCalledWith(
      decisionUpsert("DISABLED"),
    );
    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("refuses when the month's expense is already paid, and writes nothing", async () => {
    expense.findMany.mockResolvedValue([{ id: "exp_1", status: "SETTLED" }]);

    await expect(disable()).rejects.toEqual(
      new RecurringExpenseSettledError("Rent", "SETTLED"),
    );
    expect(expense.deleteMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).not.toHaveBeenCalled();
  });

  it("refuses when the month's expense is covered by someone else, and writes nothing", async () => {
    expense.findMany.mockResolvedValue([{ id: "exp_1", status: "COVERED" }]);

    await expect(disable()).rejects.toEqual(
      new RecurringExpenseSettledError("Rent", "COVERED"),
    );
    expect(expense.deleteMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).not.toHaveBeenCalled();
  });

  it("refuses without deleting even the pending one when another expense of the month is paid", async () => {
    expense.findMany.mockResolvedValue([
      { id: "exp_1", status: "PLANNED" },
      { id: "exp_2", status: "SETTLED" },
    ]);

    await expect(disable()).rejects.toBeInstanceOf(
      RecurringExpenseSettledError,
    );
    expect(expense.deleteMany).not.toHaveBeenCalled();
  });

  it("only records the decision when the month has no expense of the template", async () => {
    await disable();

    expect(expense.deleteMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).toHaveBeenCalledWith(
      decisionUpsert("DISABLED"),
    );
  });

  it("is idempotent: disabling again, with nothing left to delete, just records it again", async () => {
    expense.findMany.mockResolvedValue([{ id: "exp_1", status: "PLANNED" }]);
    await disable();
    expense.findMany.mockResolvedValue([]);
    await disable();

    expect(expense.deleteMany).toHaveBeenCalledTimes(1);
    expect(recurringExpenseDecision.upsert).toHaveBeenCalledTimes(2);
  });

  it("never creates an expense", async () => {
    await disable();

    expect(expense.createMany).not.toHaveBeenCalled();
  });
});

describe("setRecurringDecision: ownership", () => {
  it("reads the template scoped to the user and refuses one that is not theirs", async () => {
    recurringExpense.findFirst.mockResolvedValue(null);

    await expect(
      setRecurringDecision(USER_ID, "someone_elses", MONTH, "ENABLED"),
    ).rejects.toBeInstanceOf(RecurringNotFoundError);
    expect(recurringExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "someone_elses", userId: USER_ID },
    });
    expect(expense.createMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).not.toHaveBeenCalled();
  });
});

describe("updateRecurringExpense", () => {
  const INPUT: RecurringExpenseInput = {
    description: "Gym",
    amount: 4500,
    currency: "USD",
    categoryId: "cat_2",
    notes: "Monthly fee",
    accountId: "acc_1",
    originCurrency: null,
    originAmount: null,
    dayOfMonth: 20,
  };

  it("updates only the template, scoped to the user, with an explicit field list", async () => {
    await expect(updateRecurringExpense(USER_ID, "rec_1", INPUT)).resolves.toBe(
      true,
    );

    expect(recurringExpense.updateMany).toHaveBeenCalledWith({
      where: { id: "rec_1", userId: USER_ID },
      data: {
        description: "Gym",
        amount: BigInt(4500),
        currency: "USD",
        categoryId: "cat_2",
        notes: "Monthly fee",
        accountId: "acc_1",
        originCurrency: null,
        originAmount: null,
        dayOfMonth: 20,
      },
    });
  });

  it("writes the reference price as a pair, and nulls to clear it", async () => {
    await updateRecurringExpense(USER_ID, "rec_1", {
      ...INPUT,
      originCurrency: "USD",
      originAmount: 2000,
    });

    expect(recurringExpense.updateMany.mock.calls[0][0].data).toMatchObject({
      originCurrency: "USD",
      originAmount: BigInt(2000),
    });

    await updateRecurringExpense(USER_ID, "rec_1", INPUT);

    const { data } = recurringExpense.updateMany.mock.calls[1][0];

    expect(data.originCurrency).toBeNull();
    expect(data.originAmount).toBeNull();
  });

  it("never touches the expenses already created from the template", async () => {
    await updateRecurringExpense(USER_ID, "rec_1", INPUT);

    expect(expense.updateMany).not.toHaveBeenCalled();
    expect(expense.createMany).not.toHaveBeenCalled();
    expect(expense.deleteMany).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.upsert).not.toHaveBeenCalled();
  });

  it("checks that the category is the user's before writing", async () => {
    db.expenseCategory.findFirst.mockResolvedValue(null);

    await expect(
      updateRecurringExpense(USER_ID, "rec_1", INPUT),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(db.expenseCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_2", userId: USER_ID },
      select: { id: true },
    });
    expect(recurringExpense.updateMany).not.toHaveBeenCalled();
  });

  it("checks the new account and lets the template keep the one it has, even if archived", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ accountId: "acc_old" }),
    );

    await updateRecurringExpense(USER_ID, "rec_1", {
      ...INPUT,
      accountId: "acc_old",
    });

    expect(recurringExpense.findFirst).toHaveBeenCalledWith({
      where: { id: "rec_1", userId: USER_ID },
      select: { accountId: true },
    });
    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_old",
      currency: INPUT.currency,
      keepAccountId: "acc_old",
    });
    expect(recurringExpense.updateMany.mock.calls[0][0].data.accountId).toBe(
      "acc_old",
    );
  });

  it("refuses to move the template to another archived account, keeping only the one it has", async () => {
    recurringExpense.findFirst.mockResolvedValue(
      templateRow({ accountId: "acc_old" }),
    );
    usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

    await expect(
      updateRecurringExpense(USER_ID, "rec_1", {
        ...INPUT,
        accountId: "acc_other_archived",
      }),
    ).rejects.toBeInstanceOf(AccountArchivedError);
    expect(usable.assertUsableAccount).toHaveBeenCalledWith(USER_ID, {
      accountId: "acc_other_archived",
      currency: INPUT.currency,
      keepAccountId: "acc_old",
    });
    expect(recurringExpense.updateMany).not.toHaveBeenCalled();
  });

  it("writes nothing when the account is refused", async () => {
    usable.assertUsableAccount.mockRejectedValue(new AccountArchivedError());

    await expect(
      updateRecurringExpense(USER_ID, "rec_1", INPUT),
    ).rejects.toBeInstanceOf(AccountArchivedError);
    expect(recurringExpense.updateMany).not.toHaveBeenCalled();
  });

  it("checks no account for a template that is not the user's", async () => {
    recurringExpense.findFirst.mockResolvedValue(null);

    await expect(updateRecurringExpense(USER_ID, "rec_9", INPUT)).resolves.toBe(
      false,
    );
    expect(usable.assertUsableAccount).not.toHaveBeenCalled();
    expect(recurringExpense.updateMany).not.toHaveBeenCalled();
  });

  it("returns false for a template that is not the user's", async () => {
    recurringExpense.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      updateRecurringExpense(USER_ID, "someone_elses", INPUT),
    ).resolves.toBe(false);
  });
});

describe("removeRecurringExpense", () => {
  it("deletes the template, scoped to the user", async () => {
    await expect(removeRecurringExpense(USER_ID, "rec_1")).resolves.toBe(true);

    expect(recurringExpense.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["rec_1"] }, userId: USER_ID },
    });
  });

  it("keeps the expenses it created as ordinary ones, clearing their flag before the template goes", async () => {
    const order: string[] = [];

    expense.updateMany.mockImplementation(async () => {
      order.push("flag");

      return { count: 2 };
    });
    recurringExpense.deleteMany.mockImplementation(async () => {
      order.push("delete");

      return { count: 1 };
    });

    await removeRecurringExpense(USER_ID, "rec_1");

    expect(expense.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, recurringExpenseId: { in: ["rec_1"] } },
      data: { isRecurring: false },
    });
    expect(order).toEqual(["flag", "delete"]);
    expect(expense.deleteMany).not.toHaveBeenCalled();
  });

  it("does both in one transaction", async () => {
    await removeRecurringExpense(USER_ID, "rec_1");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
  });

  it("returns false for a template that is not the user's", async () => {
    recurringExpense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      removeRecurringExpense(USER_ID, "someone_elses"),
    ).resolves.toBe(false);
  });
});
