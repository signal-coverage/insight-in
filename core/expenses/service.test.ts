import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  // The transaction callback receives this same object, so the writes made inside it are
  // observed on the same mocks.
  $transaction: vi.fn(),
  expense: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  recurringExpense: {
    create: vi.fn(),
    count: vi.fn(),
  },
  recurringExpenseDecision: {
    create: vi.fn(),
  },
  expenseCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";
import type { EntriesQuery } from "@/core/entries/query";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "@/core/incomes/errors";

import {
  createCategory,
  createExpense,
  deleteCategory,
  deleteExpense,
  listCategories,
  listCategoriesWithCounts,
  listExpenseCurrencies,
  listExpenses,
  listExpenseTotals,
  renameCategory,
  setExpenseStatus,
  updateExpense,
} from "./service";
import type { ExpenseInput } from "./types";

const { expense, expenseCategory, recurringExpense, recurringExpenseDecision } =
  db;

const USER_ID = "user_123";
const INCLUDE = { category: { select: { name: true } } };

const query = (patch: Partial<EntriesQuery> = {}): EntriesQuery => ({
  ...DEFAULT_ENTRIES_QUERY,
  ...patch,
});

const input: ExpenseInput = {
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
  isRecurring: false,
};

const recurringInput: ExpenseInput = { ...input, isRecurring: true };

const row = {
  id: "exp_1",
  userId: USER_ID,
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Alquiler" },
  notes: null,
  status: "SETTLED",
  isRecurring: false,
  recurringExpenseId: null,
  createdAt: new Date("2026-09-06T10:00:00.000Z"),
  updatedAt: new Date("2026-09-06T10:00:00.000Z"),
};

const WRITABLE_DATA = {
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  date: new Date("2026-09-05T00:00:00.000Z"),
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
};

const TEMPLATE_DATA = {
  description: "Monthly rent",
  amount: BigInt(35000050),
  currency: "ARS",
  categoryId: "cat_1",
  notes: null,
  dayOfMonth: 5,
};

beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation((run: (tx: typeof db) => unknown) =>
    run(db),
  );
  expenseCategory.findFirst.mockResolvedValue({
    id: "cat_1",
    name: "Alquiler",
  });
});

describe("createExpense", () => {
  it("verifies the category belongs to the user before writing", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(expenseCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("stores the record for the user with a bigint amount and a UTC date", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(expense.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, ...WRITABLE_DATA, isRecurring: false },
      include: INCLUDE,
    });
  });

  it("returns the created expense as a plain object", async () => {
    expense.create.mockResolvedValue(row);

    await expect(createExpense(USER_ID, input)).resolves.toEqual({
      ...input,
      id: "exp_1",
      categoryName: "Alquiler",
    });
  });

  it("rejects a category the user does not own without writing", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(createExpense(USER_ID, input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(expense.create).not.toHaveBeenCalled();
  });

  it("creates no template for an expense that is not recurring", async () => {
    expense.create.mockResolvedValue(row);

    await createExpense(USER_ID, input);

    expect(db.$transaction).not.toHaveBeenCalled();
    expect(recurringExpense.create).not.toHaveBeenCalled();
    expect(recurringExpenseDecision.create).not.toHaveBeenCalled();
  });

  describe("when it is marked as recurring", () => {
    beforeEach(() => {
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      expense.create.mockResolvedValue({
        ...row,
        isRecurring: true,
        recurringExpenseId: "rec_1",
      });
      recurringExpenseDecision.create.mockResolvedValue({});
    });

    it("remembers a template copied from the saved values, on the day of the expense", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(recurringExpense.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, ...TEMPLATE_DATA },
      });
    });

    it("links the expense to the template and keeps the flag in step with the link", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(expense.create).toHaveBeenCalledWith({
        data: {
          userId: USER_ID,
          ...WRITABLE_DATA,
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
        include: INCLUDE,
      });
    });

    it("records an enabled decision for the month of the expense, so it is not asked again", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(recurringExpenseDecision.create).toHaveBeenCalledWith({
        data: {
          recurringExpenseId: "rec_1",
          month: "2026-09",
          decision: "ENABLED",
        },
      });
    });

    it("does all of it in one transaction", async () => {
      await createExpense(USER_ID, recurringInput);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
    });

    it("returns the created expense with the recurring mark", async () => {
      await expect(
        createExpense(USER_ID, recurringInput),
      ).resolves.toMatchObject({ id: "exp_1", isRecurring: true });
    });

    it("writes nothing when the category is not the user's", async () => {
      expenseCategory.findFirst.mockResolvedValue(null);

      await expect(
        createExpense(USER_ID, recurringInput),
      ).rejects.toBeInstanceOf(CategoryNotFoundError);
      expect(db.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe("updateExpense", () => {
  const found = (recurringExpenseId: string | null) =>
    expense.findFirst.mockResolvedValue({ recurringExpenseId });

  it("looks the record up scoped to the user", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 1 });

    await updateExpense(USER_ID, "exp_1", input);

    expect(expense.findFirst).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      select: { recurringExpenseId: true },
    });
  });

  it("only touches a record owned by the user, with an explicit field list", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 1 });

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(true);
    expect(expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { ...WRITABLE_DATA, isRecurring: false },
    });
  });

  it("returns false, writing nothing, when the record is not the user's", async () => {
    expense.findFirst.mockResolvedValue(null);

    await expect(updateExpense(USER_ID, "exp_9", input)).resolves.toBe(false);
    expect(expense.updateMany).not.toHaveBeenCalled();
    expect(recurringExpense.create).not.toHaveBeenCalled();
  });

  it("returns false when the record disappears before the write", async () => {
    found(null);
    expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateExpense(USER_ID, "exp_1", input)).resolves.toBe(false);
  });

  describe("an expense that is not linked to a template", () => {
    it("creates a template, links the expense and records an enabled decision when the switch is on", async () => {
      found(null);
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      expense.updateMany.mockResolvedValue({ count: 1 });
      recurringExpenseDecision.create.mockResolvedValue({});

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).resolves.toBe(true);

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      expect(recurringExpense.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, ...TEMPLATE_DATA },
      });
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: { id: "exp_1", userId: USER_ID },
        data: {
          ...WRITABLE_DATA,
          isRecurring: true,
          recurringExpenseId: "rec_1",
        },
      });
      expect(recurringExpenseDecision.create).toHaveBeenCalledWith({
        data: {
          recurringExpenseId: "rec_1",
          month: "2026-09",
          decision: "ENABLED",
        },
      });
    });

    it("undoes the whole transaction, template included, when the expense is gone by the time it is linked", async () => {
      let rolledBackWith: unknown;

      db.$transaction.mockImplementation(
        async (run: (tx: typeof db) => unknown) => {
          try {
            return await run(db);
          } catch (error) {
            // A throw inside the callback is what makes the database roll back.
            rolledBackWith = error;
            throw error;
          }
        },
      );
      found(null);
      recurringExpense.create.mockResolvedValue({ id: "rec_1" });
      recurringExpenseDecision.create.mockResolvedValue({});
      expense.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).resolves.toBe(false);
      expect(rolledBackWith).toBeInstanceOf(Error);
    });

    it("creates nothing when the switch is off", async () => {
      found(null);
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", input);

      expect(db.$transaction).not.toHaveBeenCalled();
      expect(recurringExpense.create).not.toHaveBeenCalled();
    });
  });

  describe("an expense that is linked to a template", () => {
    it("never touches the template, whatever the form says", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", {
        ...recurringInput,
        description: "Changed",
        amount: 1,
      });

      expect(recurringExpense.create).not.toHaveBeenCalled();
      expect(recurringExpenseDecision.create).not.toHaveBeenCalled();
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it("keeps the link and the flag even when the form sends the switch off", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await updateExpense(USER_ID, "exp_1", input);

      const { data } = expense.updateMany.mock.calls[0][0];

      expect(data).toMatchObject({ isRecurring: true });
      expect(data).not.toHaveProperty("recurringExpenseId");
    });

    it("still saves the changes to the row itself", async () => {
      found("rec_1");
      expense.updateMany.mockResolvedValue({ count: 1 });

      await expect(
        updateExpense(USER_ID, "exp_1", recurringInput),
      ).resolves.toBe(true);
      expect(expense.updateMany).toHaveBeenCalledWith({
        where: { id: "exp_1", userId: USER_ID },
        data: { ...WRITABLE_DATA, isRecurring: true },
      });
    });
  });
});

describe("setExpenseStatus", () => {
  it("only touches a record owned by the user and changes nothing else", async () => {
    expense.updateMany.mockResolvedValue({ count: 1 });

    await expect(setExpenseStatus(USER_ID, "exp_1", "PLANNED")).resolves.toBe(
      true,
    );
    expect(expense.updateMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
      data: { status: "PLANNED" },
    });
  });

  it("returns false when the record is not the user's", async () => {
    expense.updateMany.mockResolvedValue({ count: 0 });

    await expect(setExpenseStatus(USER_ID, "exp_9", "SETTLED")).resolves.toBe(
      false,
    );
  });
});

describe("deleteExpense", () => {
  it("only deletes a record owned by the user", async () => {
    expense.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteExpense(USER_ID, "exp_1")).resolves.toBe(true);
    expect(expense.deleteMany).toHaveBeenCalledWith({
      where: { id: "exp_1", userId: USER_ID },
    });
  });

  it("returns false when nothing matched", async () => {
    expense.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteExpense(USER_ID, "exp_9")).resolves.toBe(false);
  });
});

describe("listExpenses", () => {
  it("returns one page of plain objects with the paging numbers", async () => {
    expense.count.mockResolvedValue(1);
    expense.findMany.mockResolvedValue([{ ...row, isRecurring: true }]);

    const result = await listExpenses(USER_ID, query());

    expect(result).toMatchObject({
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(result.rows[0]).toMatchObject({
      id: "exp_1",
      categoryName: "Alquiler",
      isRecurring: true,
    });
    expect(expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        include: INCLUDE,
        skip: 0,
        take: 25,
      }),
    );
  });

  it("applies the status filter", async () => {
    expense.count.mockResolvedValue(0);
    expense.findMany.mockResolvedValue([]);

    await listExpenses(USER_ID, query({ status: "PLANNED" }));

    expect(expense.findMany.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      status: "PLANNED",
    });
  });

  it("clamps a page past the end to the last page", async () => {
    expense.count.mockResolvedValue(30);
    expense.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([row]);

    const result = await listExpenses(USER_ID, query({ page: 9 }));

    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    expect(expense.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 25 }),
    );
  });
});

describe("listExpenseTotals", () => {
  it("sums per currency and status over the whole filtered set", async () => {
    expense.groupBy.mockResolvedValue([
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(50000) } },
    ]);

    await expect(
      listExpenseTotals(USER_ID, query({ categoryId: "cat_1" })),
    ).resolves.toEqual([{ currency: "ARS", total: 150000, settled: 100000 }]);
    expect(expense.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status"],
      where: { userId: USER_ID, categoryId: "cat_1" },
      _sum: { amount: true },
    });
  });
});

describe("listExpenseCurrencies", () => {
  it("lists the distinct currencies the user has expenses in", async () => {
    expense.groupBy.mockResolvedValue([
      { currency: "ARS" },
      { currency: "USD" },
    ]);

    await expect(listExpenseCurrencies(USER_ID)).resolves.toEqual([
      "ARS",
      "USD",
    ]);
    expect(expense.groupBy).toHaveBeenCalledWith({
      by: ["currency"],
      where: { userId: USER_ID },
      orderBy: { currency: "asc" },
    });
  });
});

describe("listCategories", () => {
  it("returns the user's categories alphabetically without seeding", async () => {
    expenseCategory.findMany.mockResolvedValue([
      { id: "c2", userId: USER_ID, name: "Salud", createdAt: new Date() },
      { id: "c1", userId: USER_ID, name: "Comida", createdAt: new Date() },
    ]);

    await expect(listCategories(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Comida" },
      { id: "c2", name: "Salud" },
    ]);
    expect(expenseCategory.createMany).not.toHaveBeenCalled();
  });

  it("seeds the default categories for a user with none, tolerating races", async () => {
    expenseCategory.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "c1", userId: USER_ID, name: "Alquiler", createdAt: new Date() },
      ]);
    expenseCategory.createMany.mockResolvedValue({ count: 6 });

    const result = await listCategories(USER_ID);

    expect(expenseCategory.createMany).toHaveBeenCalledWith({
      data: [
        "Alquiler",
        "Servicios",
        "Comida",
        "Transporte",
        "Salud",
        "Otros",
      ].map((name) => ({
        userId: USER_ID,
        name,
      })),
      skipDuplicates: true,
    });
    expect(result).toEqual([{ id: "c1", name: "Alquiler" }]);
  });
});

describe("listCategoriesWithCounts", () => {
  it("adds how many expenses use each category", async () => {
    expenseCategory.findMany.mockResolvedValue([
      {
        id: "c1",
        userId: USER_ID,
        name: "Comida",
        createdAt: new Date(),
        _count: { expenses: 4 },
      },
    ]);

    await expect(listCategoriesWithCounts(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Comida", expenseCount: 4 },
    ]);
  });
});

describe("createCategory", () => {
  it("checks for a case-insensitive duplicate within the user's categories", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);
    expenseCategory.create.mockResolvedValue({
      id: "c9",
      userId: USER_ID,
      name: "Mascotas",
    });

    await expect(createCategory(USER_ID, "Mascotas")).resolves.toEqual({
      id: "c9",
      name: "Mascotas",
    });
    expect(expenseCategory.findFirst).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        name: { equals: "Mascotas", mode: "insensitive" },
      },
      select: { id: true },
    });
  });

  it("rejects a duplicate name", async () => {
    expenseCategory.findFirst.mockResolvedValue({ id: "c1" });

    await expect(createCategory(USER_ID, "comida")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
    expect(expenseCategory.create).not.toHaveBeenCalled();
  });

  it("maps the unique constraint of a race to a duplicate", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);
    expenseCategory.create.mockRejectedValue({ code: "P2002" });

    await expect(createCategory(USER_ID, "Comida")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });
});

describe("renameCategory", () => {
  it("renames a category owned by the user", async () => {
    expenseCategory.findFirst
      .mockResolvedValueOnce({ id: "c1", name: "Comida" })
      .mockResolvedValueOnce(null);
    expenseCategory.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      renameCategory(USER_ID, "c1", "Supermercado"),
    ).resolves.toEqual({
      id: "c1",
      name: "Supermercado",
    });
    expect(expenseCategory.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
      data: { name: "Supermercado" },
    });
  });

  it("reports a category that is not the user's", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(renameCategory(USER_ID, "c9", "X")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it("rejects a name that clashes with another category", async () => {
    expenseCategory.findFirst
      .mockResolvedValueOnce({ id: "c1", name: "Comida" })
      .mockResolvedValueOnce({ id: "c2" });

    await expect(renameCategory(USER_ID, "c1", "Salud")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });
});

describe("deleteCategory", () => {
  const owned = (expenses: number, recurringExpenses = 0) => ({
    id: "c1",
    _count: { expenses, recurringExpenses },
  });

  it("deletes an unused category when it is not the last one", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(3);
    expenseCategory.deleteMany.mockResolvedValue({ count: 1 });

    await deleteCategory(USER_ID, "c1");

    expect(expenseCategory.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
    });
  });

  it("blocks a category that expenses still use and reports the count", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(2));

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({ count: 2 });
    expect(expenseCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks a category that only a recurring template uses, and reports it", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0, 1));

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({ count: 0, recurringCount: 1 });
    expect(expenseCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks the last remaining category", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(1);

    await expect(deleteCategory(USER_ID, "c1")).rejects.toBeInstanceOf(
      LastCategoryError,
    );
  });

  it("reports a category that is not the user's", async () => {
    expenseCategory.findFirst.mockResolvedValue(null);

    await expect(deleteCategory(USER_ID, "c9")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });

  it("reports in-use when an expense is attached between the check and the delete", async () => {
    expenseCategory.findFirst.mockResolvedValue(owned(0));
    expenseCategory.count.mockResolvedValue(3);
    expenseCategory.deleteMany.mockRejectedValue({ code: "P2003" });
    expense.count.mockResolvedValue(1);
    recurringExpense.count.mockResolvedValue(2);

    const error = await deleteCategory(USER_ID, "c1").catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error).toMatchObject({ count: 1, recurringCount: 2 });
  });
});
