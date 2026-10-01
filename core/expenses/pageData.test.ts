import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  listExpenseTotals: vi.fn(),
  listCategoriesWithCounts: vi.fn(),
  listExpenseCurrencies: vi.fn(),
}));
const recurring = vi.hoisted(() => ({ listRecurringExpenses: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("./recurringService", () => recurring);

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { loadExpensesPageData } from "./pageData";

const PAGE = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 };
const TEMPLATE = {
  id: "rec_1",
  description: "Rent",
  amount: 35000050,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  dayOfMonth: 5,
  decision: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  // 2026-10-15 in Argentina, whatever the machine's zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  service.listExpenses.mockResolvedValue(PAGE);
  service.listExpenseTotals.mockResolvedValue([]);
  service.listCategoriesWithCounts.mockResolvedValue([]);
  service.listExpenseCurrencies.mockResolvedValue(["ARS"]);
  recurring.listRecurringExpenses.mockResolvedValue([TEMPLATE]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadExpensesPageData", () => {
  it("reads the page, the totals, the categories, the currencies and the recurring templates for the user and the query", async () => {
    const query = { ...DEFAULT_ENTRIES_QUERY, status: "PLANNED" as const };

    const data = await loadExpensesPageData("user_1", query);

    expect(data).toEqual({
      page: PAGE,
      totals: [],
      categories: [],
      currencies: ["ARS"],
      recurring: { month: "2026-10", items: [TEMPLATE] },
    });
    expect(service.listExpenses).toHaveBeenCalledWith("user_1", query);
    expect(service.listExpenseTotals).toHaveBeenCalledWith("user_1", query);
    expect(service.listCategoriesWithCounts).toHaveBeenCalledWith("user_1");
    expect(service.listExpenseCurrencies).toHaveBeenCalledWith("user_1");
  });

  it("asks for the decisions of the current month, whatever month the list is filtered to", async () => {
    await loadExpensesPageData("user_1", {
      ...DEFAULT_ENTRIES_QUERY,
      from: "2026-03-01",
      to: "2026-03-31",
    });

    expect(recurring.listRecurringExpenses).toHaveBeenCalledWith(
      "user_1",
      "2026-10",
    );
  });

  it("starts every read together instead of one after another", async () => {
    const order: string[] = [];

    service.listExpenses.mockImplementation(async () => {
      order.push("page:start");
      await Promise.resolve();
      order.push("page:end");

      return PAGE;
    });
    service.listExpenseCurrencies.mockImplementation(async () => {
      order.push("currencies:start");

      return [];
    });

    await loadExpensesPageData("user_1", DEFAULT_ENTRIES_QUERY);

    expect(order.indexOf("currencies:start")).toBeLessThan(
      order.indexOf("page:end"),
    );
  });

  it("fails as a whole when any read fails, so the page reaches its error boundary", async () => {
    service.listExpenseTotals.mockRejectedValue(new Error("database down"));

    await expect(
      loadExpensesPageData("user_1", DEFAULT_ENTRIES_QUERY),
    ).rejects.toThrow("database down");
  });
});
