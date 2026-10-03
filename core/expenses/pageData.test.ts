import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listExpenses: vi.fn(),
  listExpenseTotals: vi.fn(),
  listCategoriesWithCounts: vi.fn(),
  listExpenseCurrencies: vi.fn(),
}));
const recurring = vi.hoisted(() => ({ listRecurringExpenses: vi.fn() }));
const installments = vi.hoisted(() => ({ listInstallmentPlans: vi.fn() }));
const progress = vi.hoisted(() => ({ listExpensePlanProgress: vi.fn() }));

const cardsService = vi.hoisted(() => ({ listCardsWithCharges: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("./recurringService", () => recurring);
vi.mock("@/core/installments/service", () => installments);
vi.mock("@/core/installments/progress", () => progress);
vi.mock("@/core/cards/service", () => cardsService);

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
const CARD = {
  id: "card_1",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
  charges: [],
};
const PLAN = {
  id: "plan_1",
  description: "Heladera",
  categoryName: "Hogar",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 100000,
  defaultCount: 1,
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
  installments.listInstallmentPlans.mockResolvedValue([PLAN]);
  cardsService.listCardsWithCharges.mockResolvedValue([CARD]);
  progress.listExpensePlanProgress.mockResolvedValue({});
});

afterEach(() => {
  vi.useRealTimers();
});

describe("loadExpensesPageData", () => {
  it("reads the page, the totals, the categories, the currencies, the recurring templates, the installment plans and the cards for the user and the query", async () => {
    const query = { ...DEFAULT_ENTRIES_QUERY, status: "PLANNED" as const };

    const data = await loadExpensesPageData("user_1", query);

    expect(data).toEqual({
      page: PAGE,
      planProgress: {},
      totals: [],
      categories: [],
      currencies: ["ARS"],
      recurring: { month: "2026-10", items: [TEMPLATE], plans: [PLAN] },
      cards: [CARD],
    });
    expect(cardsService.listCardsWithCharges).toHaveBeenCalledWith("user_1");
    expect(installments.listInstallmentPlans).toHaveBeenCalledWith(
      "user_1",
      "2026-10",
    );
    expect(service.listExpenses).toHaveBeenCalledWith("user_1", query);
    expect(service.listExpenseTotals).toHaveBeenCalledWith("user_1", query);
    expect(service.listCategoriesWithCounts).toHaveBeenCalledWith("user_1");
    expect(service.listExpenseCurrencies).toHaveBeenCalledWith("user_1");
  });

  it("loads the progress of the plans the page's rows belong to, once for all of them", async () => {
    const rows = [
      { id: "e1", installmentPlanId: "plan_1" },
      { id: "e2", installmentPlanId: "plan_1" },
      { id: "e3", installmentPlanId: "plan_2" },
      { id: "e4", installmentPlanId: null },
    ];

    service.listExpenses.mockResolvedValue({ ...PAGE, rows });
    progress.listExpensePlanProgress.mockResolvedValue({
      plan_1: { total: 12, settled: 3 },
    });

    const data = await loadExpensesPageData("user_1", DEFAULT_ENTRIES_QUERY);

    expect(progress.listExpensePlanProgress).toHaveBeenCalledTimes(1);
    expect(progress.listExpensePlanProgress).toHaveBeenCalledWith("user_1", [
      "plan_1",
      "plan_2",
    ]);
    expect(data.planProgress).toEqual({ plan_1: { total: 12, settled: 3 } });
  });

  it("asks for no progress when the page has no installments", async () => {
    service.listExpenses.mockResolvedValue({
      ...PAGE,
      rows: [{ id: "e1", installmentPlanId: null }],
    });

    await loadExpensesPageData("user_1", DEFAULT_ENTRIES_QUERY);

    expect(progress.listExpensePlanProgress).toHaveBeenCalledWith("user_1", []);
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
