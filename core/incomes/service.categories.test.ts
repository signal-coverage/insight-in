import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { count: vi.fn() },
  recurringIncome: { count: vi.fn() },
  incomeCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "./errors";
import {
  deleteCategory,
  listCategoriesWithCounts,
  renameCategory,
} from "./service";

const { income, incomeCategory, recurringIncome } = db;

const USER_ID = "user_123";

const P2002 = Object.assign(new Error("Unique constraint failed"), {
  code: "P2002",
});
const P2003 = Object.assign(new Error("Foreign key constraint failed"), {
  code: "P2003",
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe("listCategoriesWithCounts", () => {
  it("returns the user's categories with their income counts, sorted by name", async () => {
    incomeCategory.findMany.mockResolvedValue([
      {
        id: "c2",
        userId: USER_ID,
        name: "Salary",
        createdAt: new Date(),
        _count: { incomes: 3 },
      },
      {
        id: "c1",
        userId: USER_ID,
        name: "Gifts",
        createdAt: new Date(),
        _count: { incomes: 0 },
      },
    ]);

    await expect(listCategoriesWithCounts(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Gifts", incomeCount: 0 },
      { id: "c2", name: "Salary", incomeCount: 3 },
    ]);
    expect(incomeCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: { _count: { select: { incomes: true } } },
    });
  });

  it("seeds the defaults for a user with none and then returns them", async () => {
    incomeCategory.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        id: "c1",
        userId: USER_ID,
        name: "Other",
        createdAt: new Date(),
        _count: { incomes: 0 },
      },
    ]);
    incomeCategory.createMany.mockResolvedValue({ count: 5 });

    await expect(listCategoriesWithCounts(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Other", incomeCount: 0 },
    ]);
    expect(incomeCategory.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });
});

describe("renameCategory", () => {
  const owned = (name = "Salary") => ({ id: "c1", name });

  it("renames a category the user owns", async () => {
    incomeCategory.findFirst
      .mockResolvedValueOnce(owned())
      .mockResolvedValueOnce(null);
    incomeCategory.updateMany.mockResolvedValue({ count: 1 });

    await expect(renameCategory(USER_ID, "c1", "Pay")).resolves.toEqual({
      id: "c1",
      name: "Pay",
    });

    expect(incomeCategory.findFirst).toHaveBeenNthCalledWith(1, {
      where: { id: "c1", userId: USER_ID },
      select: { id: true, name: true },
    });
    expect(incomeCategory.findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: USER_ID,
        id: { not: "c1" },
        name: { equals: "Pay", mode: "insensitive" },
      },
      select: { id: true },
    });
    expect(incomeCategory.updateMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
      data: { name: "Pay" },
    });
  });

  it("rejects a category the user does not own without writing", async () => {
    incomeCategory.findFirst.mockResolvedValueOnce(null);

    await expect(renameCategory(USER_ID, "c1", "Pay")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(incomeCategory.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a name another category already uses", async () => {
    incomeCategory.findFirst
      .mockResolvedValueOnce(owned())
      .mockResolvedValueOnce({ id: "c2" });

    await expect(renameCategory(USER_ID, "c1", "Gifts")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
    expect(incomeCategory.updateMany).not.toHaveBeenCalled();
  });

  it("allows changing only the casing of its own name", async () => {
    incomeCategory.findFirst
      .mockResolvedValueOnce(owned())
      .mockResolvedValueOnce(null);
    incomeCategory.updateMany.mockResolvedValue({ count: 1 });

    await expect(renameCategory(USER_ID, "c1", "salary")).resolves.toEqual({
      id: "c1",
      name: "salary",
    });
  });

  it("treats an identical name as a no-op", async () => {
    incomeCategory.findFirst.mockResolvedValueOnce(owned());

    await expect(renameCategory(USER_ID, "c1", "Salary")).resolves.toEqual({
      id: "c1",
      name: "Salary",
    });
    expect(incomeCategory.updateMany).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to a duplicate error", async () => {
    incomeCategory.findFirst
      .mockResolvedValueOnce(owned())
      .mockResolvedValueOnce(null);
    incomeCategory.updateMany.mockRejectedValue(P2002);

    await expect(renameCategory(USER_ID, "c1", "Pay")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });

  it("reports not found when the category vanished before the write", async () => {
    incomeCategory.findFirst
      .mockResolvedValueOnce(owned())
      .mockResolvedValueOnce(null);
    incomeCategory.updateMany.mockResolvedValue({ count: 0 });

    await expect(renameCategory(USER_ID, "c1", "Pay")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});

describe("deleteCategory", () => {
  const withCount = (incomes: number, recurringIncomes = 0) => ({
    id: "c1",
    _count: { incomes, recurringIncomes },
  });

  it("deletes an unused category the user owns while others remain", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(0));
    incomeCategory.count.mockResolvedValue(2);
    incomeCategory.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteCategory(USER_ID, "c1")).resolves.toBeUndefined();

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
      select: {
        id: true,
        _count: { select: { incomes: true, recurringIncomes: true } },
      },
    });
    expect(incomeCategory.count).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(incomeCategory.deleteMany).toHaveBeenCalledWith({
      where: { id: "c1", userId: USER_ID },
    });
  });

  it("rejects a category the user does not own without writing", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(deleteCategory(USER_ID, "c1")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(incomeCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks deleting a category that still has incomes and reports the count", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(3));

    const error = await deleteCategory(USER_ID, "c1").catch((caught) => caught);

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error.count).toBe(3);
    expect(incomeCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("blocks deleting the last remaining category", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(0));
    incomeCategory.count.mockResolvedValue(1);

    await expect(deleteCategory(USER_ID, "c1")).rejects.toBeInstanceOf(
      LastCategoryError,
    );
    expect(incomeCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("re-counts and reports in-use when an income appears before the delete", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(0));
    incomeCategory.count.mockResolvedValue(2);
    incomeCategory.deleteMany.mockRejectedValue(P2003);
    income.count.mockResolvedValue(2);
    recurringIncome.count.mockResolvedValue(1);

    const error = await deleteCategory(USER_ID, "c1").catch((caught) => caught);

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error.count).toBe(2);
    expect(error.recurringCount).toBe(1);
    expect(income.count).toHaveBeenCalledWith({
      where: { categoryId: "c1", userId: USER_ID },
    });
    expect(recurringIncome.count).toHaveBeenCalledWith({
      where: { categoryId: "c1", userId: USER_ID },
    });
  });

  it("blocks deleting a category that a recurring income still uses and reports the count", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(0, 2));

    const error = await deleteCategory(USER_ID, "c1").catch((caught) => caught);

    expect(error).toBeInstanceOf(CategoryInUseError);
    expect(error.count).toBe(0);
    expect(error.recurringCount).toBe(2);
    expect(incomeCategory.deleteMany).not.toHaveBeenCalled();
  });

  it("reports both counts when incomes and recurring incomes use the category", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(3, 1));

    const error = await deleteCategory(USER_ID, "c1").catch((caught) => caught);

    expect(error.count).toBe(3);
    expect(error.recurringCount).toBe(1);
  });

  it("reports not found when the category vanished before the delete", async () => {
    incomeCategory.findFirst.mockResolvedValue(withCount(0));
    incomeCategory.count.mockResolvedValue(2);
    incomeCategory.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCategory(USER_ID, "c1")).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
  });
});
