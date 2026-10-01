import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadExpensesPageData: vi.fn() }));

vi.mock("@/core/expenses/pageData", () => pageData);

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { loadExpensesView } from "./loadExpensesView";

const EXPENSE = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  status: "SETTLED" as const,
  isRecurring: false,
};

const LOADED = {
  page: { rows: [EXPENSE], total: 1, page: 1, pageSize: 25, totalPages: 1 },
  totals: [{ currency: "ARS", total: 35000050, settled: 10000000 }],
  categories: [{ id: "c1", name: "Alquiler", expenseCount: 1 }],
  currencies: ["ARS"],
  recurring: {
    month: "2026-09",
    items: [
      {
        id: "rec_1",
        description: "Monthly rent",
        amount: 35000050,
        currency: "ARS",
        categoryId: "c1",
        categoryName: "Alquiler",
        notes: null,
        dayOfMonth: 5,
        decision: null,
      },
    ],
  },
};

const start = () => loadExpensesView("user_1", DEFAULT_ENTRIES_QUERY);

beforeEach(() => {
  pageData.loadExpensesPageData.mockReset();
});

describe("loadExpensesView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadExpensesPageData.mockReturnValue(new Promise(() => {}));

    const view = start();

    expect(Object.keys(view).sort()).toEqual([
      "categories",
      "currencies",
      "recurring",
      "table",
      "totals",
    ]);
    Object.values(view).forEach((piece) =>
      expect(piece).toBeInstanceOf(Promise),
    );
  });

  it("loads everything once and shares it between the sections", async () => {
    pageData.loadExpensesPageData.mockResolvedValue(LOADED);

    await Promise.all(Object.values(start()));

    expect(pageData.loadExpensesPageData).toHaveBeenCalledTimes(1);
    expect(pageData.loadExpensesPageData).toHaveBeenCalledWith(
      "user_1",
      DEFAULT_ENTRIES_QUERY,
    );
  });

  it("formats the totals per currency with their paid and pending parts", async () => {
    pageData.loadExpensesPageData.mockResolvedValue(LOADED);

    const [total] = await start().totals;

    expect(total.currency).toBe("ARS");
    expect(total.label).toMatch(/350\.000,50/);
    expect(total.settled).toMatch(/100\.000,00/);
    expect(total.pending).toMatch(/250\.000,50/);
  });

  it("gives the table its formatted rows, the paging and whether any expense exists", async () => {
    pageData.loadExpensesPageData.mockResolvedValue(LOADED);

    const table = await start().table;

    expect(table.rows[0]).toMatchObject({
      id: "exp_1",
      amountDecimal: "350000.50",
    });
    expect(table.rows[0].amountLabel).toMatch(/350\.000,50/);
    expect(table.pagination).toEqual({
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(table.hasAnyExpenses).toBe(true);
  });

  it("says there are no expenses at all when the user has none in any currency", async () => {
    pageData.loadExpensesPageData.mockResolvedValue({
      ...LOADED,
      page: { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
      totals: [],
      currencies: [],
    });

    const table = await start().table;

    expect(table.rows).toEqual([]);
    expect(table.hasAnyExpenses).toBe(false);
  });

  it("gives the recurring section the templates of the month with their formatted amounts and the pending count", async () => {
    pageData.loadExpensesPageData.mockResolvedValue(LOADED);

    const recurring = await start().recurring;

    expect(recurring).toMatchObject({
      month: "2026-09",
      monthLabel: "Septiembre de 2026",
      pendingCount: 1,
      decided: [],
    });
    expect(recurring.pending[0]).toMatchObject({
      id: "rec_1",
      dayLabel: "Día 5",
      amountDecimal: "350000.50",
    });
  });

  it("hands the shared category components a neutral count", async () => {
    pageData.loadExpensesPageData.mockResolvedValue(LOADED);

    const view = start();

    expect(await view.categories).toEqual([
      { id: "c1", name: "Alquiler", count: 1 },
    ]);
    expect(await view.currencies).toEqual(["ARS"]);
  });

  it("rejects every section when the load fails, so each reaches the error boundary", async () => {
    pageData.loadExpensesPageData.mockRejectedValue(new Error("database down"));

    await Promise.all(
      Object.values(start()).map((piece) =>
        expect(piece).rejects.toThrow("database down"),
      ),
    );
  });
});
