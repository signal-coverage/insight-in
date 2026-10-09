import { beforeEach, describe, expect, it, vi } from "vitest";

const pageData = vi.hoisted(() => ({ loadIncomesPageData: vi.fn() }));

vi.mock("@/core/incomes/pageData", () => pageData);

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { loadIncomesView } from "./loadIncomesView";

const INCOME = {
  id: "inc_1",
  description: "Salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  originCurrency: null,
  originAmount: null,
  reimbursesExpenseId: null,
  recurringIncomeId: null,
};

const LOADED = {
  planProgress: {},
  page: { rows: [INCOME], total: 1, page: 1, pageSize: 25, totalPages: 1 },
  totals: [{ currency: "USD", total: 250000, settled: 100000 }],
  categories: [{ id: "c1", name: "Salary", incomeCount: 1 }],
  currencies: ["USD"],
  recurring: [],
  repayments: { month: "2026-09", plans: [] },
  reimbursables: [],
  accounts: [
    {
      id: "acc_1",
      currency: "ARS",
      label: "Banco Galicia · Caja de ahorro",
      archived: false,
    },
  ],
};

const start = () =>
  loadIncomesView("user_1", DEFAULT_ENTRIES_QUERY, "2026-09-30");

beforeEach(() => {
  pageData.loadIncomesPageData.mockReset();
});

describe("loadIncomesView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    pageData.loadIncomesPageData.mockReturnValue(new Promise(() => {}));

    const view = start();

    expect(Object.keys(view).sort()).toEqual([
      "accounts",
      "categories",
      "currencies",
      "recurring",
      "reimbursables",
      "repayments",
      "table",
      "totals",
    ]);
    Object.values(view).forEach((piece) =>
      expect(piece).toBeInstanceOf(Promise),
    );
  });

  it("loads everything once and shares it between the sections", async () => {
    pageData.loadIncomesPageData.mockResolvedValue(LOADED);

    const view = start();

    await Promise.all(Object.values(view));

    expect(pageData.loadIncomesPageData).toHaveBeenCalledTimes(1);
    expect(pageData.loadIncomesPageData).toHaveBeenCalledWith(
      "user_1",
      DEFAULT_ENTRIES_QUERY,
      "2026-09-30",
    );
  });

  it("formats the totals per currency", async () => {
    pageData.loadIncomesPageData.mockResolvedValue(LOADED);

    const totals = await start().totals;

    expect(totals).toHaveLength(1);
    expect(totals[0].currency).toBe("USD");
    expect(totals[0].label).toMatch(/2.500,00/);
    expect(totals[0].settled).toMatch(/1.000,00/);
    expect(totals[0].pending).toMatch(/1.500,00/);
  });

  it("gives the table its formatted rows, the paging and whether any income exists", async () => {
    pageData.loadIncomesPageData.mockResolvedValue(LOADED);

    const table = await start().table;

    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toMatchObject({
      id: "inc_1",
      amountDecimal: "2500.00",
    });
    expect(table.rows[0].amountLabel).toMatch(/2.500,00/);
    expect(table.rows[0].dateLabel).toContain("2026");
    expect(table.pagination).toEqual({
      total: 1,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    expect(table.hasAnyIncomes).toBe(true);
  });

  it("gives each installment row the progress of its plan, for the delete dialog", async () => {
    pageData.loadIncomesPageData.mockResolvedValue({
      ...LOADED,
      planProgress: { plan_1: { total: 6, settled: 2 } },
      page: {
        ...LOADED.page,
        rows: [
          { ...INCOME, installmentPlanId: "plan_1", installmentNumber: 3 },
          { ...INCOME, id: "inc_2", installmentPlanId: null },
        ],
      },
    });

    const { rows } = await start().table;

    expect(rows[0].planProgress).toEqual({ total: 6, settled: 2 });
    expect(rows[1]).not.toHaveProperty("planProgress");
  });

  it("says there are no incomes at all when the user has none in any currency", async () => {
    pageData.loadIncomesPageData.mockResolvedValue({
      ...LOADED,
      page: { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 },
      totals: [],
      currencies: [],
    });

    const table = await start().table;

    expect(table.rows).toEqual([]);
    expect(table.hasAnyIncomes).toBe(false);
  });

  it("passes categories, currencies and recurring templates through", async () => {
    pageData.loadIncomesPageData.mockResolvedValue(LOADED);

    const view = start();

    // The shared category components count entries under a neutral name.
    expect(await view.categories).toEqual([
      { id: "c1", name: "Salary", count: 1 },
    ]);
    expect(await view.currencies).toEqual(["USD"]);
    expect(await view.recurring).toEqual([]);
  });

  it("offers the income form the expenses that still expect money, in their own currency", async () => {
    pageData.loadIncomesPageData.mockResolvedValue({
      ...LOADED,
      reimbursables: [
        {
          id: "exp_1",
          description: "Dentista",
          date: "2026-09-12",
          currency: "ARS",
          outstanding: 400000,
        },
      ],
    });

    const [option] = await start().reimbursables;

    expect(option).toMatchObject({ id: "exp_1", currency: "ARS" });
    expect(option.label).toContain("Dentista · 12/09 · faltan");
    expect(option.label).toMatch(/4.000,00/);
  });

  it("hands the forms the user's accounts as they were read", async () => {
    pageData.loadIncomesPageData.mockResolvedValue(LOADED);

    expect(await start().accounts).toEqual(LOADED.accounts);
  });

  it("gives the repayments drawer the month and the loans, formatted", async () => {
    pageData.loadIncomesPageData.mockResolvedValue({
      ...LOADED,
      repayments: {
        month: "2026-09",
        plans: [
          {
            id: "plan_1",
            description: "Préstamo a Juan",
            categoryName: "Préstamos",
            currency: "ARS",
            totalCuotas: 12,
            doneCount: 3,
            pendingCount: 9,
            nextAmount: 10000000,
            defaultCount: 1,
          },
        ],
      },
    });

    const repayments = await start().repayments;

    expect(repayments.month).toBe("2026-09");
    expect(repayments.monthLabel).toBe("Septiembre de 2026");
    expect(repayments.plans).toHaveLength(1);
    expect(repayments.plans[0]).toMatchObject({
      id: "plan_1",
      progressLabel: "3 de 12 · quedan 9",
      defaultCount: 1,
    });
    expect(repayments.plans[0].nextAmountLabel).toMatch(/100\.000,00/);
  });

  it("rejects every section when the load fails, so each reaches the error boundary", async () => {
    pageData.loadIncomesPageData.mockRejectedValue(new Error("database down"));

    const view = start();

    await Promise.all(
      Object.values(view).map((piece) =>
        expect(piece).rejects.toThrow("database down"),
      ),
    );
  });
});
