import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { groupBy: vi.fn(), createMany: vi.fn() },
  incomeCategory: { findFirst: vi.fn() },
  recurringIncome: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { CategoryNotFoundError } from "./errors";
import {
  createRecurringIncome,
  deleteRecurringIncome,
  listRecurringIncomes,
  materializeRecurringIncomes,
  updateRecurringIncome,
} from "./service";
import type { RecurringIncomeInput } from "./types";

const { income, incomeCategory, recurringIncome } = db;

const USER_ID = "user_123";

const input: RecurringIncomeInput = {
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  categoryId: "cat_1",
  notes: null,
  frequency: "MONTHLY",
  startDate: "2026-01-05",
  endDate: null,
};

const WRITABLE_DATA = {
  description: "Monthly salary",
  amount: BigInt(250000),
  currency: "USD",
  categoryId: "cat_1",
  notes: null,
  frequency: "MONTHLY",
  startDate: new Date("2026-01-05T00:00:00.000Z"),
  endDate: null,
};

const templateRow = (patch: Record<string, unknown> = {}) => ({
  id: "rec_1",
  userId: USER_ID,
  description: "Monthly salary",
  amount: BigInt(250000),
  currency: "USD",
  categoryId: "cat_1",
  category: { name: "Salary" },
  notes: null,
  frequency: "MONTHLY",
  startDate: new Date("2026-07-15T00:00:00.000Z"),
  endDate: null,
  createdAt: new Date("2026-07-01T00:00:00.000Z"),
  updatedAt: new Date("2026-07-01T00:00:00.000Z"),
  ...patch,
});

const INCLUDE = { category: { select: { name: true } } };

beforeEach(() => {
  vi.resetAllMocks();
  incomeCategory.findFirst.mockResolvedValue({ id: "cat_1" });
});

describe("listRecurringIncomes", () => {
  it("scopes to the user and includes the category name", async () => {
    recurringIncome.findMany.mockResolvedValue([]);

    await listRecurringIncomes(USER_ID);

    expect(recurringIncome.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  });

  it("maps rows to plain serializable objects", async () => {
    recurringIncome.findMany.mockResolvedValue([
      templateRow({ endDate: new Date("2026-12-15T00:00:00.000Z") }),
    ]);

    await expect(listRecurringIncomes(USER_ID)).resolves.toEqual([
      {
        id: "rec_1",
        description: "Monthly salary",
        amount: 250000,
        currency: "USD",
        categoryId: "cat_1",
        categoryName: "Salary",
        notes: null,
        frequency: "MONTHLY",
        startDate: "2026-07-15",
        endDate: "2026-12-15",
      },
    ]);
  });
});

describe("createRecurringIncome", () => {
  it("verifies the category belongs to the user before writing", async () => {
    recurringIncome.create.mockResolvedValue(templateRow());

    await createRecurringIncome(USER_ID, input);

    expect(incomeCategory.findFirst).toHaveBeenCalledWith({
      where: { id: "cat_1", userId: USER_ID },
      select: { id: true },
    });
  });

  it("stores the template for the user with a bigint amount and UTC dates", async () => {
    recurringIncome.create.mockResolvedValue(templateRow());

    await createRecurringIncome(USER_ID, input);

    expect(recurringIncome.create).toHaveBeenCalledWith({
      data: { userId: USER_ID, ...WRITABLE_DATA },
      include: INCLUDE,
    });
  });

  it("rejects a category the user does not own without writing", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(createRecurringIncome(USER_ID, input)).rejects.toBeInstanceOf(
      CategoryNotFoundError,
    );
    expect(recurringIncome.create).not.toHaveBeenCalled();
  });
});

describe("updateRecurringIncome", () => {
  it("only touches a template owned by the user", async () => {
    recurringIncome.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      updateRecurringIncome(USER_ID, "rec_1", {
        ...input,
        endDate: "2026-12-05",
      }),
    ).resolves.toBe(true);

    expect(recurringIncome.updateMany).toHaveBeenCalledWith({
      where: { id: "rec_1", userId: USER_ID },
      data: { ...WRITABLE_DATA, endDate: new Date("2026-12-05T00:00:00.000Z") },
    });
  });

  it("returns false when the template is not the user's", async () => {
    recurringIncome.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateRecurringIncome(USER_ID, "rec_x", input)).resolves.toBe(
      false,
    );
  });

  it("verifies the category and never lets the payload override the owner", async () => {
    incomeCategory.findFirst.mockResolvedValue(null);

    await expect(
      updateRecurringIncome(USER_ID, "rec_1", {
        ...input,
        userId: "attacker",
      } as never),
    ).rejects.toBeInstanceOf(CategoryNotFoundError);
    expect(recurringIncome.updateMany).not.toHaveBeenCalled();

    incomeCategory.findFirst.mockResolvedValue({ id: "cat_1" });
    recurringIncome.updateMany.mockResolvedValue({ count: 1 });
    await updateRecurringIncome(USER_ID, "rec_1", {
      ...input,
      userId: "attacker",
    } as never);

    const call = recurringIncome.updateMany.mock.calls[0][0];

    expect(call.where.userId).toBe(USER_ID);
    expect(call.data).not.toHaveProperty("userId");
  });
});

describe("deleteRecurringIncome", () => {
  it("only deletes a template owned by the user", async () => {
    recurringIncome.deleteMany.mockResolvedValue({ count: 1 });

    await expect(deleteRecurringIncome(USER_ID, "rec_1")).resolves.toBe(true);
    expect(recurringIncome.deleteMany).toHaveBeenCalledWith({
      where: { id: "rec_1", userId: USER_ID },
    });
  });

  it("returns false when nothing matched", async () => {
    recurringIncome.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteRecurringIncome(USER_ID, "rec_x")).resolves.toBe(false);
  });
});

describe("materializeRecurringIncomes", () => {
  const createdRows = () => income.createMany.mock.calls[0][0].data;

  beforeEach(() => {
    income.groupBy.mockResolvedValue([]);
    income.createMany.mockResolvedValue({ count: 0 });
  });

  it("only considers the user's templates that have already started", async () => {
    recurringIncome.findMany.mockResolvedValue([]);

    await materializeRecurringIncomes(USER_ID, "2026-09-20");

    expect(recurringIncome.findMany).toHaveBeenCalledWith({
      where: {
        userId: USER_ID,
        startDate: { lte: new Date("2026-09-20T00:00:00.000Z") },
      },
    });
  });

  it("does nothing when there are no templates", async () => {
    recurringIncome.findMany.mockResolvedValue([]);

    await expect(
      materializeRecurringIncomes(USER_ID, "2026-09-20"),
    ).resolves.toBe(0);
    expect(income.groupBy).not.toHaveBeenCalled();
    expect(income.createMany).not.toHaveBeenCalled();
  });

  it("creates every occurrence up to today, copying the template and linking it", async () => {
    recurringIncome.findMany.mockResolvedValue([templateRow()]);
    income.createMany.mockResolvedValue({ count: 3 });

    await expect(
      materializeRecurringIncomes(USER_ID, "2026-09-20"),
    ).resolves.toBe(3);

    expect(income.createMany).toHaveBeenCalledWith({
      data: ["2026-07-15", "2026-08-15", "2026-09-15"].map((date) => ({
        userId: USER_ID,
        description: "Monthly salary",
        amount: BigInt(250000),
        currency: "USD",
        categoryId: "cat_1",
        notes: null,
        date: new Date(`${date}T00:00:00.000Z`),
        recurringIncomeId: "rec_1",
        status: "PLANNED",
      })),
      skipDuplicates: true,
    });
  });

  it("looks up the latest generated income per template", async () => {
    recurringIncome.findMany.mockResolvedValue([templateRow()]);

    await materializeRecurringIncomes(USER_ID, "2026-09-20");

    expect(income.groupBy).toHaveBeenCalledWith({
      by: ["recurringIncomeId"],
      where: { userId: USER_ID, recurringIncomeId: { in: ["rec_1"] } },
      _max: { date: true },
    });
  });

  it("only creates what is newer than the latest generated income", async () => {
    recurringIncome.findMany.mockResolvedValue([templateRow()]);
    income.groupBy.mockResolvedValue([
      {
        recurringIncomeId: "rec_1",
        _max: { date: new Date("2026-08-15T00:00:00.000Z") },
      },
    ]);

    await materializeRecurringIncomes(USER_ID, "2026-09-20");

    expect(
      createdRows().map((row: { date: Date }) =>
        row.date.toISOString().slice(0, 10),
      ),
    ).toEqual(["2026-09-15"]);
  });

  it("does not write when the template is already up to date", async () => {
    recurringIncome.findMany.mockResolvedValue([templateRow()]);
    income.groupBy.mockResolvedValue([
      {
        recurringIncomeId: "rec_1",
        _max: { date: new Date("2026-09-15T00:00:00.000Z") },
      },
    ]);

    await expect(
      materializeRecurringIncomes(USER_ID, "2026-09-20"),
    ).resolves.toBe(0);
    expect(income.createMany).not.toHaveBeenCalled();
  });

  it("stops at the end date of a series that has ended", async () => {
    recurringIncome.findMany.mockResolvedValue([
      templateRow({ endDate: new Date("2026-08-31T00:00:00.000Z") }),
    ]);

    await materializeRecurringIncomes(USER_ID, "2026-09-20");

    expect(
      createdRows().map((row: { date: Date }) =>
        row.date.toISOString().slice(0, 10),
      ),
    ).toEqual(["2026-07-15", "2026-08-15"]);
  });

  it("batches every template into a single idempotent insert", async () => {
    recurringIncome.findMany.mockResolvedValue([
      templateRow(),
      templateRow({
        id: "rec_2",
        description: "Rent share",
        frequency: "WEEKLY",
        startDate: new Date("2026-09-06T00:00:00.000Z"),
      }),
    ]);

    await materializeRecurringIncomes(USER_ID, "2026-09-20");

    expect(income.createMany).toHaveBeenCalledTimes(1);
    expect(income.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(
      createdRows().map(
        (row: { recurringIncomeId: string }) => row.recurringIncomeId,
      ),
    ).toEqual(["rec_1", "rec_1", "rec_1", "rec_2", "rec_2", "rec_2"]);
  });
});
