import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  income: { findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("@/infrastructure/db/client", () => ({ prisma: db }));

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";
import { listIncomeCurrencies, listIncomes, listIncomeTotals } from "./service";
import type { EntriesQuery } from "@/core/entries/query";

const { income } = db;

const USER_ID = "user_123";

const INCLUDE = { category: { select: { name: true } } };

const query = (patch: Partial<EntriesQuery> = {}): EntriesQuery => ({
  ...DEFAULT_ENTRIES_QUERY,
  ...patch,
});

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
  recurringIncomeId: "rec_1",
  createdAt: new Date("2026-09-02T10:00:00.000Z"),
  updatedAt: new Date("2026-09-02T10:00:00.000Z"),
};

const findManyArgs = () => income.findMany.mock.calls[0][0];

beforeEach(() => {
  vi.resetAllMocks();
  income.count.mockResolvedValue(1);
  income.findMany.mockResolvedValue([row]);
});

describe("listIncomes", () => {
  it("scopes to the user and returns the first page newest first by default", async () => {
    await listIncomes(USER_ID);

    expect(income.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(income.findMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      include: INCLUDE,
      orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      skip: 0,
      take: 25,
    });
  });

  it("maps rows to plain serializable objects and reports the paging", async () => {
    await expect(listIncomes(USER_ID, query())).resolves.toEqual({
      rows: [
        {
          id: "inc_1",
          description: "September salary",
          amount: 150050,
          currency: "USD",
          date: "2026-09-01",
          categoryId: "cat_1",
          categoryName: "Salary",
          notes: null,
          recurringIncomeId: "rec_1",
        },
      ],
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
  });

  it("fails loudly when an amount cannot be represented exactly", async () => {
    income.findMany.mockResolvedValue([
      { ...row, amount: BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1) },
    ]);

    await expect(listIncomes(USER_ID)).rejects.toThrow(RangeError);
  });

  it("filters by category and currency", async () => {
    await listIncomes(USER_ID, query({ categoryId: "cat_2", currency: "EUR" }));

    expect(findManyArgs().where).toEqual({
      userId: USER_ID,
      categoryId: "cat_2",
      currency: "EUR",
    });
    expect(income.count).toHaveBeenCalledWith({
      where: { userId: USER_ID, categoryId: "cat_2", currency: "EUR" },
    });
  });

  it("filters by an inclusive date range", async () => {
    await listIncomes(USER_ID, query({ from: "2026-01-01", to: "2026-03-31" }));

    expect(findManyArgs().where).toEqual({
      userId: USER_ID,
      date: {
        gte: new Date("2026-01-01T00:00:00.000Z"),
        lte: new Date("2026-03-31T00:00:00.000Z"),
      },
    });
  });

  it("supports an open-ended range", async () => {
    await listIncomes(USER_ID, query({ from: "2026-01-01" }));
    expect(findManyArgs().where.date).toEqual({
      gte: new Date("2026-01-01T00:00:00.000Z"),
    });

    income.findMany.mockClear();
    await listIncomes(USER_ID, query({ to: "2026-03-31" }));
    expect(findManyArgs().where.date).toEqual({
      lte: new Date("2026-03-31T00:00:00.000Z"),
    });
  });

  it.each([
    [
      { sort: "date", direction: "asc" },
      [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    ],
    [
      { sort: "description", direction: "asc" },
      [
        { description: "asc" },
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    ],
    [
      { sort: "description", direction: "desc" },
      [
        { description: "desc" },
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    ],
    [
      { sort: "category", direction: "asc" },
      [
        { category: { name: "asc" } },
        { date: "desc" },
        { createdAt: "desc" },
        { id: "desc" },
      ],
    ],
  ] as const)(
    "orders by %j with stable tie-breakers",
    async (sort, orderBy) => {
      await listIncomes(USER_ID, query(sort));

      expect(findManyArgs().orderBy).toEqual(orderBy);
    },
  );

  it("skips previous pages", async () => {
    income.count.mockResolvedValue(80);

    const page = await listIncomes(USER_ID, query({ page: 3 }));

    expect(findManyArgs()).toMatchObject({ skip: 50, take: 25 });
    expect(page).toMatchObject({ page: 3, total: 80, totalPages: 4 });
  });

  it("runs the count and the page query concurrently, once each, for an in-range page", async () => {
    let releaseCount: (value: number) => void = () => {};

    income.count.mockReturnValue(
      new Promise<number>((resolve) => {
        releaseCount = resolve;
      }),
    );

    const pending = listIncomes(USER_ID, query({ page: 2 }));

    // The page query starts without waiting for the count to settle.
    await Promise.resolve();
    expect(income.findMany).toHaveBeenCalledTimes(1);

    releaseCount(80);
    await pending;

    expect(income.count).toHaveBeenCalledTimes(1);
    expect(income.findMany).toHaveBeenCalledTimes(1);
    expect(findManyArgs()).toMatchObject({ skip: 25, take: 25 });
  });

  it("re-queries exactly once for the last page when the requested page is out of range", async () => {
    income.count.mockResolvedValue(30);

    const page = await listIncomes(USER_ID, query({ page: 9 }));

    expect(income.findMany).toHaveBeenCalledTimes(2);
    expect(income.findMany.mock.calls[0][0]).toMatchObject({ skip: 200 });
    expect(income.findMany.mock.calls[1][0]).toMatchObject({
      skip: 25,
      take: 25,
    });
    expect(page).toMatchObject({ page: 2, totalPages: 2, total: 30 });
  });

  it("returns the rows of the clamped page, not of the requested one", async () => {
    income.count.mockResolvedValue(30);
    income.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...row, id: "inc_last" }]);

    const page = await listIncomes(USER_ID, query({ page: 9 }));

    expect(page.rows.map((item) => item.id)).toEqual(["inc_last"]);
  });

  it("does not query again when the last page is the requested one", async () => {
    income.count.mockResolvedValue(30);

    await listIncomes(USER_ID, query({ page: 2 }));

    expect(income.findMany).toHaveBeenCalledTimes(1);
  });

  it("reports a single empty page without a second query when nothing matches", async () => {
    income.count.mockResolvedValue(0);
    income.findMany.mockResolvedValue([]);

    await expect(listIncomes(USER_ID, query({ page: 4 }))).resolves.toEqual({
      rows: [],
      total: 0,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(income.findMany).toHaveBeenCalledTimes(1);
  });
});

describe("listIncomeTotals", () => {
  it("sums per currency over the whole filtered set, ignoring paging and sorting", async () => {
    income.groupBy.mockResolvedValue([
      { currency: "USD", status: "SETTLED", _sum: { amount: BigInt(2000) } },
      { currency: "USD", status: "PLANNED", _sum: { amount: BigInt(500) } },
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
    ]);

    await expect(
      listIncomeTotals(
        USER_ID,
        query({
          categoryId: "cat_1",
          from: "2026-01-01",
          page: 5,
          sort: "description",
        }),
      ),
    ).resolves.toEqual([
      { currency: "ARS", total: 100000, settled: 100000 },
      { currency: "USD", total: 2500, settled: 2000 },
    ]);
    expect(income.groupBy).toHaveBeenCalledWith({
      by: ["currency", "status"],
      where: {
        userId: USER_ID,
        categoryId: "cat_1",
        date: { gte: new Date("2026-01-01T00:00:00.000Z") },
      },
      _sum: { amount: true },
    });
  });

  it("honours the currency filter", async () => {
    income.groupBy.mockResolvedValue([]);

    await listIncomeTotals(USER_ID, query({ currency: "EUR" }));

    expect(income.groupBy.mock.calls[0][0].where).toEqual({
      userId: USER_ID,
      currency: "EUR",
    });
  });

  it("skips currencies without a sum", async () => {
    income.groupBy.mockResolvedValue([
      { currency: "USD", status: "SETTLED", _sum: { amount: null } },
    ]);

    await expect(listIncomeTotals(USER_ID, query())).resolves.toEqual([]);
  });
});

describe("listIncomeCurrencies", () => {
  it("lists the distinct currencies the user has incomes in", async () => {
    income.groupBy.mockResolvedValue([
      { currency: "ARS" },
      { currency: "USD" },
    ]);

    await expect(listIncomeCurrencies(USER_ID)).resolves.toEqual([
      "ARS",
      "USD",
    ]);
    expect(income.groupBy).toHaveBeenCalledWith({
      by: ["currency"],
      where: { userId: USER_ID },
      orderBy: { currency: "asc" },
    });
  });
});
