import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  listIncomes: vi.fn(),
  listIncomeTotals: vi.fn(),
  listCategoriesWithCounts: vi.fn(),
  listIncomeCurrencies: vi.fn(),
  listRecurringIncomes: vi.fn(),
  materializeRecurringIncomes: vi.fn(),
}));

const installments = vi.hoisted(() => ({
  listIncomeInstallmentPlans: vi.fn(),
}));

const reimbursements = vi.hoisted(() => ({
  listReimbursableExpenses: vi.fn(),
}));

const progress = vi.hoisted(() => ({ listIncomePlanProgress: vi.fn() }));
const choices = vi.hoisted(() => ({ listAccountChoices: vi.fn() }));

vi.mock("./service", () => service);
vi.mock("@/core/reimbursements/service", () => reimbursements);
vi.mock("@/core/installments/incomeService", () => installments);
vi.mock("@/core/installments/progress", () => progress);
vi.mock("@/core/accounts/choices", () => choices);

import { loadIncomesPageData } from "./pageData";
import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

const USER_ID = "user_123";
const TODAY = "2026-09-30";

const reads = (label: string) => {
  service.listIncomes.mockResolvedValue({
    rows: [],
    total: 0,
    page: 1,
    pageSize: 25,
    totalPages: 1,
    label,
  });
  service.listIncomeTotals.mockResolvedValue([
    { currency: "USD", total: label.length },
  ]);
  service.listCategoriesWithCounts.mockResolvedValue([]);
  service.listIncomeCurrencies.mockResolvedValue(["USD"]);
  service.listRecurringIncomes.mockResolvedValue([]);
  installments.listIncomeInstallmentPlans.mockResolvedValue([]);
  reimbursements.listReimbursableExpenses.mockResolvedValue([]);
};

const READS = [
  service.listIncomes,
  service.listIncomeTotals,
  service.listCategoriesWithCounts,
  service.listIncomeCurrencies,
  service.listRecurringIncomes,
  installments.listIncomeInstallmentPlans,
];

beforeEach(() => {
  vi.resetAllMocks();
  reads("first");
  service.materializeRecurringIncomes.mockResolvedValue(0);
  progress.listIncomePlanProgress.mockResolvedValue({});
  choices.listAccountChoices.mockResolvedValue([
    {
      id: "acc_1",
      currency: "USD",
      label: "Banco Galicia · Dólares",
      archived: false,
    },
  ]);
});

describe("loadIncomesPageData", () => {
  it("passes the user, query and today to the service functions", async () => {
    await loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY);

    expect(service.materializeRecurringIncomes).toHaveBeenCalledWith(
      USER_ID,
      TODAY,
    );
    expect(service.listIncomes).toHaveBeenCalledWith(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
    );
    expect(service.listIncomeTotals).toHaveBeenCalledWith(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
    );
    expect(service.listCategoriesWithCounts).toHaveBeenCalledWith(USER_ID);
    expect(service.listIncomeCurrencies).toHaveBeenCalledWith(USER_ID);
    expect(service.listRecurringIncomes).toHaveBeenCalledWith(USER_ID);
  });

  it("reads the loans repaid in installments for the current month, whatever range the list is filtered to", async () => {
    const plans = [{ id: "plan_1", defaultCount: 1 }];

    installments.listIncomeInstallmentPlans.mockResolvedValue(plans);

    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    expect(installments.listIncomeInstallmentPlans).toHaveBeenCalledWith(
      USER_ID,
      "2026-09",
    );
    expect(data.repayments).toEqual({ month: "2026-09", plans });
  });

  it("loads the progress of the plans of the final page's rows, once for all of them", async () => {
    const rows = [
      { id: "i1", installmentPlanId: "plan_1" },
      { id: "i2", installmentPlanId: "plan_1" },
      { id: "i3", installmentPlanId: null },
    ];

    service.listIncomes.mockResolvedValue({
      rows,
      total: 3,
      page: 1,
      pageSize: 25,
      totalPages: 1,
    });
    progress.listIncomePlanProgress.mockResolvedValue({
      plan_1: { total: 6, settled: 2 },
    });

    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    expect(progress.listIncomePlanProgress).toHaveBeenCalledTimes(1);
    expect(progress.listIncomePlanProgress).toHaveBeenCalledWith(USER_ID, [
      "plan_1",
    ]);
    expect(data.planProgress).toEqual({ plan_1: { total: 6, settled: 2 } });
  });

  it("reads the expenses an income can pay back, once, along with everything else", async () => {
    const reimbursable = [
      {
        id: "exp_1",
        description: "Dentista",
        date: "2026-09-12",
        currency: "ARS",
        outstanding: 400000,
      },
    ];

    reimbursements.listReimbursableExpenses.mockResolvedValue(reimbursable);
    service.materializeRecurringIncomes.mockResolvedValue(2);

    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    // Generating recurring incomes changes nothing about them, so even the second pass reads them once.
    expect(reimbursements.listReimbursableExpenses).toHaveBeenCalledTimes(1);
    expect(reimbursements.listReimbursableExpenses).toHaveBeenCalledWith(
      USER_ID,
    );
    expect(data.reimbursables).toEqual(reimbursable);
  });

  it("reads the user's accounts once, for the income, template and repayment forms", async () => {
    service.materializeRecurringIncomes.mockResolvedValue(2);

    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    expect(choices.listAccountChoices).toHaveBeenCalledTimes(1);
    expect(choices.listAccountChoices).toHaveBeenCalledWith(USER_ID);
    expect(data.accounts).toEqual([
      {
        id: "acc_1",
        currency: "USD",
        label: "Banco Galicia · Dólares",
        archived: false,
      },
    ]);
  });

  it("uses the first reads, exactly once, when nothing was generated", async () => {
    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    READS.forEach((read) => expect(read).toHaveBeenCalledTimes(1));
    expect(service.materializeRecurringIncomes).toHaveBeenCalledTimes(1);
    expect(data.page).toMatchObject({ label: "first" });
    expect(data.totals).toEqual([{ currency: "USD", total: 5 }]);
    expect(data.currencies).toEqual(["USD"]);
  });

  it("starts the reads and the generation at the same time", async () => {
    let releaseMaterialize: (value: number) => void = () => {};

    service.materializeRecurringIncomes.mockReturnValue(
      new Promise<number>((resolve) => {
        releaseMaterialize = resolve;
      }),
    );

    const pending = loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY);

    await Promise.resolve();

    // Generation is still pending, yet every read has already been issued.
    READS.forEach((read) => expect(read).toHaveBeenCalledTimes(1));

    releaseMaterialize(0);
    await pending;
  });

  it("re-runs the reads and returns the second result when incomes were generated", async () => {
    service.materializeRecurringIncomes.mockResolvedValue(2);
    service.listIncomes
      .mockResolvedValueOnce({
        rows: [],
        total: 0,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        label: "stale",
      })
      .mockResolvedValueOnce({
        rows: [],
        total: 2,
        page: 1,
        pageSize: 25,
        totalPages: 1,
        label: "fresh",
      });

    const data = await loadIncomesPageData(
      USER_ID,
      DEFAULT_ENTRIES_QUERY,
      TODAY,
    );

    READS.forEach((read) => expect(read).toHaveBeenCalledTimes(2));
    expect(service.materializeRecurringIncomes).toHaveBeenCalledTimes(1);
    expect(data.page).toMatchObject({ label: "fresh", total: 2 });
  });

  it("does not run the second reads until generation has finished", async () => {
    let releaseMaterialize: (value: number) => void = () => {};

    service.materializeRecurringIncomes.mockReturnValue(
      new Promise<number>((resolve) => {
        releaseMaterialize = resolve;
      }),
    );

    const pending = loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY);

    await Promise.resolve();
    await Promise.resolve();
    expect(service.listIncomes).toHaveBeenCalledTimes(1);

    releaseMaterialize(1);
    await pending;

    expect(service.listIncomes).toHaveBeenCalledTimes(2);
  });

  it("propagates a failing read", async () => {
    service.listIncomeTotals.mockRejectedValue(new Error("db down"));

    await expect(
      loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY),
    ).rejects.toThrow("db down");
  });

  it("propagates a failing generation", async () => {
    service.materializeRecurringIncomes.mockRejectedValue(
      new Error("insert failed"),
    );

    await expect(
      loadIncomesPageData(USER_ID, DEFAULT_ENTRIES_QUERY, TODAY),
    ).rejects.toThrow("insert failed");
  });
});
