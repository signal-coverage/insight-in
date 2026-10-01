import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  incomeCategory: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { CategoryNotFoundError, DuplicateCategoryError } from "./errors";
import {
  createCategory,
  createIncome,
  deleteIncome,
  listCategories,
  updateIncome,
  setIncomeStatus,
} from "./service";
import type { IncomeInput } from "./types";

const { income, incomeCategory } = db;

const USER_ID = "user_123";

const input: IncomeInput = {
  description: "September salary",
  amount: 150050,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
};

const row = {
  id: "inc_1",
  userId: USER_ID,
  description: "September salary",
  amount: BigInt(150050),
  currency: "USD",
  date: new Date("2026-09-01T00:00:00.000Z"),
  categoryId: "cat_1",
  category: { name: "Salary" },
  notes: null,
  status: "SETTLED",
  recurringIncomeId: null,
  createdAt: new Date("2026-09-02T10:00:00.000Z"),
  updatedAt: new Date("2026-09-02T10:00:00.000Z"),
};

const WRITABLE_DATA = {
  description: "September salary",
  amount: BigInt(150050),
  currency: "USD",
  date: new Date("2026-09-01T00:00:00.000Z"),
  categoryId: "cat_1",
  notes: null,
  status: "SETTLED",
};

beforeEach(() => {
  vi.resetAllMocks();
  incomeCategory.findFirst.mockResolvedValue({ id: "cat_1", name: "Salary" });
});

describe("createIncome", () => {
  it("verifies the category belongs to the user before writing", async () => {
    income.create.mockResolvedValue(row);

    await createIncome(USER_ID, input);

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("stores the record for the user with a bigint amount and a UTC date", async () => {
    income.create.mockResolvedValue(row);

    await createIncome(USER_ID, input);

    expect(income.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, ...WRITABLE_DATA },
      include: { category: { select: { name: true } } },
    });
  });

  it("stores the status it is given", async () => {
    income.create.mockResolvedValue({ ...row, status: "PLANNED" });

    await createIncome(USER_ID, { ...input, status: "PLANNED" });

    expect(income.create.mock.calls[0][0].data.status).toBe("PLANNED");
  });

  it("returns the created income as a plain object", async () => {
    income.create.mockResolvedValue(row);

    await expect(createIncome(USER_ID, input)).resolves.toMatchObject({
      id: "inc_1",
      amount: 150050,
      date: "2026-09-01",
      categoryName: "Salary",
      status: "SETTLED",
    });
  });

  it("rejects a category the user does not own without writing", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(createIncome(USER_ID, input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(income.create).not.toHaveBeenCalled();
  });
});

describe("setIncomeStatus", () => {
  it("only touches a record owned by the user and changes nothing else", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await expect(setIncomeStatus(USER_ID, "inc_1", "PLANNED")).resolves.toBe(
      true,
    );
    expect(income.updateMany).toHaveBeenCalledWith({
      where: { id: "inc_1", userId: USER_ID },
      data: { status: "PLANNED" },
    });
  });

  it("returns false when the record is not the user's", async () => {
    income.updateMany.mockResolvedValue({ count: 0 });

    await expect(setIncomeStatus(USER_ID, "inc_9", "SETTLED")).resolves.toBe(
      false,
    );
  });
});

describe("updateIncome", () => {
  it("verifies the category belongs to the user", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await updateIncome(USER_ID, "inc_1", input);

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("only touches a record owned by the user", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await updateIncome(USER_ID, "inc_1", input);

    expect(income.updateMany).toHaveBeenCalledWith({
      where: { id: "inc_1", userId: USER_ID },
      data: WRITABLE_DATA,
    });
  });

  it("returns true when a record was updated", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await expect(updateIncome(USER_ID, "inc_1", input)).resolves.toBe(true);
  });

  it("returns false when the record does not exist or belongs to someone else", async () => {
    income.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateIncome(USER_ID, "inc_other", input)).resolves.toBe(
      false,
    );
  });

  it("rejects a category the user does not own without writing", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(updateIncome(USER_ID, "inc_1", input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(income.updateMany).not.toHaveBeenCalled();
  });

  it("never lets the payload override the owner", async () => {
    income.updateMany.mockResolvedValue({ count: 1 });

    await updateIncome(USER_ID, "inc_1", {
      ...input,
      userId: "attacker",
    } as IncomeInput);

    const call = income.updateMany.mock.calls[0][0];

    expect(call.where.userId).toBe(USER_ID);
    expect(call.data).not.toHaveProperty("userId");
  });
});

describe("deleteIncome", () => {
  it("only deletes a record owned by the user", async () => {
    income.deleteMany.mockResolvedValue({ count: 1 });

    await deleteIncome(USER_ID, "inc_1");

    expect(income.deleteMany).toHaveBeenCalledWith({
      where: { id: "inc_1", userId: USER_ID },
    });
  });

  it("returns true when a record was deleted", async () => {
    income.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteIncome(USER_ID, "inc_1")).resolves.toBe(true);
  });

  it("returns false when nothing matched", async () => {
    income.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteIncome(USER_ID, "inc_other")).resolves.toBe(false);
  });
});

describe("listCategories", () => {
  it("returns the user's categories sorted by name without seeding", async () => {
    incomeCategory.findMany.mockResolvedValue([
      { id: "c2", userId: USER_ID, name: "salary", createdAt: new Date() },
      { id: "c1", userId: USER_ID, name: "Freelance", createdAt: new Date() },
      { id: "c3", userId: USER_ID, name: "Zeta", createdAt: new Date() },
    ]);

    await expect(listCategories(USER_ID)).resolves.toEqual([
      { id: "c1", name: "Freelance" },
      { id: "c2", name: "salary" },
      { id: "c3", name: "Zeta" },
    ]);
    expect(incomeCategory.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
    });
    expect(incomeCategory.createMany).not.toHaveBeenCalled();
  });

  it("seeds the default categories for a user with none, tolerating races", async () => {
    incomeCategory.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { id: "c1", userId: USER_ID, name: "Salary", createdAt: new Date() },
      { id: "c2", userId: USER_ID, name: "Other", createdAt: new Date() },
    ]);
    incomeCategory.createMany.mockResolvedValue({ count: 5 });

    const result = await listCategories(USER_ID);

    expect(incomeCategory.createMany).toHaveBeenCalledWith({
      data: ["Sueldo", "Freelance", "Inversiones", "Regalos", "Otros"].map(
        (name) => ({
          userId: USER_ID,
          name,
        }),
      ),
      skipDuplicates: true,
    });
    expect(result).toEqual([
      { id: "c2", name: "Other" },
      { id: "c1", name: "Salary" },
    ]);
  });
});

describe("createCategory", () => {
  it("checks for a case-insensitive duplicate within the user's categories", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);
    incomeCategory.create.mockResolvedValue({
      id: "c9",
      userId: USER_ID,
      name: "Rent",
    });

    await createCategory(USER_ID, "Rent");

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { userId: USER_ID, name: { equals: "Rent", mode: "insensitive" } },
      select: { id: true },
    });
  });

  it("creates the category for the user and returns it", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);
    incomeCategory.create.mockResolvedValue({
      id: "c9",
      userId: USER_ID,
      name: "Rent",
    });

    await expect(createCategory(USER_ID, "Rent")).resolves.toEqual({
      id: "c9",
      name: "Rent",
    });
    expect(incomeCategory.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, name: "Rent" },
    });
  });

  it("rejects a duplicate name without writing", async () => {
    incomeCategory.findFirst.mockResolvedValue({ id: "c1" });

    await expect(createCategory(USER_ID, "salary")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
    expect(incomeCategory.create).not.toHaveBeenCalled();
  });

  it("maps a unique-constraint race to a duplicate error", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);
    incomeCategory.create.mockRejectedValue(
      Object.assign(new Error("Unique constraint failed"), { code: "P2002" }),
    );

    await expect(createCategory(USER_ID, "Rent")).rejects.toBeInstanceOf(
      DuplicateCategoryError,
    );
  });

  it("rethrows unexpected database errors", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);
    incomeCategory.create.mockRejectedValue(new Error("connection refused"));

    await expect(createCategory(USER_ID, "Rent")).rejects.toThrow(
      "connection refused",
    );
  });
});
