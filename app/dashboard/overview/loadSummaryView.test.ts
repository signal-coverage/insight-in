import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getMonthlySummary: vi.fn() }));
const balances = vi.hoisted(() => ({ getOpeningBalanceEditorData: vi.fn() }));
const settings = vi.hoisted(() => ({ getUserSettings: vi.fn() }));

vi.mock("@/core/summary/service", () => service);
vi.mock("@/core/balances/service", () => balances);
vi.mock("@/core/settings/service", () => settings);

import { loadSummaryView } from "./loadSummaryView";

const ARS = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 70000,
  target: 90000,
  wallet: 25000,
  available: 95000,
  pendingReimbursements: 0,
};

beforeEach(() => {
  service.getMonthlySummary.mockReset();
  balances.getOpeningBalanceEditorData.mockReset();
  settings.getUserSettings.mockReset();
  settings.getUserSettings.mockResolvedValue({ includeExpectedIncomes: true });
  balances.getOpeningBalanceEditorData.mockResolvedValue({
    opening: null,
    currencies: ["ARS"],
  });
});

describe("loadSummaryView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    service.getMonthlySummary.mockReturnValue(new Promise(() => {}));
    balances.getOpeningBalanceEditorData.mockReturnValue(new Promise(() => {}));
    settings.getUserSettings.mockReturnValue(new Promise(() => {}));

    const view = loadSummaryView("user_1", "2026-09");

    expect(view.summary).toBeInstanceOf(Promise);
    expect(view.openingBalance).toBeInstanceOf(Promise);
    expect(view.includeExpectedIncomes).toBeInstanceOf(Promise);
  });

  it("asks for the user's own month, with the user's setting", async () => {
    service.getMonthlySummary.mockResolvedValue([]);

    await loadSummaryView("user_1", "2026-09").summary;

    expect(settings.getUserSettings).toHaveBeenCalledWith("user_1");
    expect(service.getMonthlySummary).toHaveBeenCalledWith(
      "user_1",
      "2026-09",
      {
        includeExpectedIncomes: true,
      },
    );
  });

  it("leaves the expected incomes out of the summary when the user turned them off", async () => {
    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: false,
    });
    service.getMonthlySummary.mockResolvedValue([]);

    await loadSummaryView("user_1", "2026-09").summary;

    expect(service.getMonthlySummary).toHaveBeenCalledWith(
      "user_1",
      "2026-09",
      {
        includeExpectedIncomes: false,
      },
    );
  });

  it("hands the page the saved setting on its own, so the switch does not wait for the cards", async () => {
    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: false,
    });
    // The cards never arrive; the switch's value must not depend on them.
    service.getMonthlySummary.mockReturnValue(new Promise(() => {}));

    await expect(
      loadSummaryView("user_1", "2026-09").includeExpectedIncomes,
    ).resolves.toBe(false);
  });

  it("reads the setting only once for the summary and the switch together", async () => {
    service.getMonthlySummary.mockResolvedValue([]);

    const view = loadSummaryView("user_1", "2026-09");

    await Promise.all([view.summary, view.includeExpectedIncomes]);

    expect(settings.getUserSettings).toHaveBeenCalledTimes(1);
  });

  it("rejects the switch's value when the setting cannot be read", async () => {
    settings.getUserSettings.mockRejectedValue(new Error("database down"));

    const view = loadSummaryView("user_1", "2026-09");

    await expect(view.includeExpectedIncomes).rejects.toThrow("database down");
    await expect(view.summary).rejects.toThrow("database down");
  });

  it("hands the page the amounts already formatted in their currency", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);

    const [row] = await loadSummaryView("user_1", "2026-09").summary;

    expect(row.currency).toBe("ARS");
    expect(row.incomes.total).toMatch(/1\.400,00/);
    expect(row.expenses.pending).toMatch(/200,00/);
    expect(row.previous).toMatch(/5\.000,00/);
    expect(row.current).toMatch(/700,00/);
    expect(row.target).toMatch(/900,00/);
    expect(row.wallet).toMatch(/250,00/);
    expect(row.available).toMatch(/950,00/);
  });

  it("rejects when the load fails, so the page reaches its error boundary", async () => {
    service.getMonthlySummary.mockRejectedValue(new Error("database down"));

    await expect(loadSummaryView("user_1", "2026-09").summary).rejects.toThrow(
      "database down",
    );
  });

  it("loads the opening balance editor's data for the user, apart from the summary", async () => {
    service.getMonthlySummary.mockResolvedValue([]);
    balances.getOpeningBalanceEditorData.mockResolvedValue({
      opening: {
        month: "2026-06",
        amounts: [{ currency: "ARS", medium: "DIGITAL", amount: 500050 }],
      },
      currencies: ["ARS", "USD"],
    });

    const view = loadSummaryView("user_1", "2026-09");

    expect(balances.getOpeningBalanceEditorData).toHaveBeenCalledWith("user_1");
    await expect(view.openingBalance).resolves.toEqual({
      month: "2026-06",
      rows: [
        { currency: "ARS", digital: "5000.50", cash: "" },
        { currency: "USD", digital: "", cash: "" },
      ],
    });
  });

  it("does not let a failing editor load take the summary down with it", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    balances.getOpeningBalanceEditorData.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09");

    await expect(view.summary).resolves.toHaveLength(1);
    await expect(view.openingBalance).rejects.toThrow("boom");
  });
});
