import { beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({ getMonthlySummary: vi.fn() }));
const balances = vi.hoisted(() => ({ getOpeningBalanceEditorData: vi.fn() }));
const settings = vi.hoisted(() => ({ getUserSettings: vi.fn() }));
const accounts = vi.hoisted(() => ({ listAccountBalanceRows: vi.fn() }));
const chartReads = vi.hoisted(() => ({ readMonthChartSources: vi.fn() }));
const attentionReads = vi.hoisted(() => ({ readAttentionSources: vi.fn() }));

vi.mock("@/core/summary/service", () => service);
vi.mock("@/core/balances/service", () => balances);
vi.mock("@/core/settings/service", () => settings);
vi.mock("@/core/summary/byAccount", () => accounts);
vi.mock("@/core/summary/charts", () => chartReads);
vi.mock("@/core/summary/attentionSources", () => attentionReads);

import { toSummaryRows } from "@/components/Summary/utils";

import { loadSummaryView } from "./loadSummaryView";

const TODAY = "2026-09-15";

const NO_CHART_ROWS = {
  incomes: [],
  expenses: [],
  categories: [],
  categoryNames: [],
};

const NO_ATTENTION_ROWS = {
  plannedExpenses: [],
  plannedIncomes: [],
  reimbursements: [],
  cards: [],
};

const ARS = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 70000,
  target: 90000,
  pendingReimbursements: 0,
};

const CASH_ACCOUNT = {
  accountId: "acc_cash",
  bankId: "bank_cash",
  bankName: "Efectivo",
  accountName: "Efectivo",
  currency: "ARS",
  archived: false,
};

beforeEach(() => {
  service.getMonthlySummary.mockReset();
  balances.getOpeningBalanceEditorData.mockReset();
  settings.getUserSettings.mockReset();
  accounts.listAccountBalanceRows.mockReset();
  accounts.listAccountBalanceRows.mockResolvedValue([]);
  chartReads.readMonthChartSources.mockReset();
  attentionReads.readAttentionSources.mockReset();
  chartReads.readMonthChartSources.mockResolvedValue(NO_CHART_ROWS);
  attentionReads.readAttentionSources.mockResolvedValue(NO_ATTENTION_ROWS);
  settings.getUserSettings.mockResolvedValue({ includeExpectedIncomes: true });
  balances.getOpeningBalanceEditorData.mockResolvedValue({
    opening: null,
    accounts: [CASH_ACCOUNT],
  });
});

describe("loadSummaryView", () => {
  it("returns at once, without waiting for the data: that is what lets the page render first", () => {
    // Never settles: if the function awaited it, this line would hang the test.
    service.getMonthlySummary.mockReturnValue(new Promise(() => {}));
    balances.getOpeningBalanceEditorData.mockReturnValue(new Promise(() => {}));
    settings.getUserSettings.mockReturnValue(new Promise(() => {}));
    chartReads.readMonthChartSources.mockReturnValue(new Promise(() => {}));
    attentionReads.readAttentionSources.mockReturnValue(new Promise(() => {}));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    expect(view.summary).toBeInstanceOf(Promise);
    expect(view.openingBalance).toBeInstanceOf(Promise);
    expect(view.includeExpectedIncomes).toBeInstanceOf(Promise);
    expect(view.attention).toBeInstanceOf(Promise);
    expect(view.charts).toBeInstanceOf(Promise);
  });

  it("asks for the user's own month, with the user's setting", async () => {
    service.getMonthlySummary.mockResolvedValue([]);

    await loadSummaryView("user_1", "2026-09", TODAY).summary;

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

    await loadSummaryView("user_1", "2026-09", TODAY).summary;

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
      loadSummaryView("user_1", "2026-09", TODAY).includeExpectedIncomes,
    ).resolves.toBe(false);
  });

  it("reads the setting only once for the summary and the switch together", async () => {
    service.getMonthlySummary.mockResolvedValue([]);

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await Promise.all([view.summary, view.includeExpectedIncomes]);

    expect(settings.getUserSettings).toHaveBeenCalledTimes(1);
  });

  it("rejects the switch's value when the setting cannot be read", async () => {
    settings.getUserSettings.mockRejectedValue(new Error("database down"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.includeExpectedIncomes).rejects.toThrow("database down");
    await expect(view.hiddenCurrencies).rejects.toThrow("database down");
    await expect(view.summary).rejects.toThrow("database down");
  });

  it("hands the page the amounts already formatted in their currency", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);

    const [row] = await loadSummaryView("user_1", "2026-09", TODAY).summary;

    expect(row.currency).toBe("ARS");
    expect(row.incomes.total).toMatch(/1\.400,00/);
    expect(row.expenses.pending).toMatch(/200,00/);
    expect(row.previous).toMatch(/5\.000,00/);
    expect(row.current).toMatch(/700,00/);
    expect(row.target).toMatch(/900,00/);
  });

  it("rejects when the load fails, so the page reaches its error boundary", async () => {
    service.getMonthlySummary.mockRejectedValue(new Error("database down"));

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).summary,
    ).rejects.toThrow("database down");
  });

  it("loads the opening balance editor's data for the user, apart from the summary", async () => {
    service.getMonthlySummary.mockResolvedValue([]);
    balances.getOpeningBalanceEditorData.mockResolvedValue({
      opening: {
        month: "2026-06",
        amounts: [{ accountId: "acc_cash", currency: "ARS", amount: 500050 }],
      },
      accounts: [CASH_ACCOUNT],
    });

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    expect(balances.getOpeningBalanceEditorData).toHaveBeenCalledWith("user_1");
    await expect(view.openingBalance).resolves.toEqual({
      month: "2026-06",
      groups: [
        {
          bankId: "bank_cash",
          bankName: "Efectivo",
          rows: [
            {
              index: 0,
              accountId: "acc_cash",
              currency: "ARS",
              label: "Efectivo (ARS)",
              amount: "5000.50",
            },
          ],
        },
      ],
    });
  });

  it("does not let a failing editor load take the summary down with it", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    balances.getOpeningBalanceEditorData.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.summary).resolves.toHaveLength(1);
    await expect(view.openingBalance).rejects.toThrow("boom");
  });

  it("reads the accounts' balances for the 'Por cuenta' card, grouped and formatted, independently of the month", async () => {
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a1",
        accountName: "Efectivo",
        bankId: "b1",
        bankName: "Efectivo",
        currency: "ARS",
        balance: 1000,
        archived: false,
      },
    ]);

    service.getMonthlySummary.mockResolvedValue([]);

    const view = loadSummaryView("user_1", "2026-03", TODAY);

    await expect(view.accountBalances).resolves.toEqual([
      expect.objectContaining({
        currency: "ARS",
        banks: [expect.objectContaining({ bankName: "Efectivo" })],
      }),
    ]);
    expect(accounts.listAccountBalanceRows).toHaveBeenCalledWith("user_1");
  });
  it("does not let a failing accounts read take the overview down: 'Por cuenta' just has no rows", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.summary).resolves.toHaveLength(1);
    await expect(view.accountBalances).resolves.toEqual([]);
  });

  it("still yields the rows when the accounts read resolves", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a1",
        accountName: "Efectivo",
        bankId: "b1",
        bankName: "Efectivo",
        currency: "ARS",
        balance: 1000,
        archived: false,
      },
    ]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).accountBalances,
    ).resolves.toHaveLength(1);
  });

  it("keeps every figure of a currency exactly as the month's summary computes it (the tabs only add zero rows)", async () => {
    const USD = { ...ARS, currency: "USD", previous: 1, current: 2 };

    service.getMonthlySummary.mockResolvedValue([ARS, USD]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).summary,
    ).resolves.toEqual(toSummaryRows([ARS, USD]));
  });

  it("gives a currency the user holds an account in a tab at zero, after ARS", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a2",
        accountName: "Dólares",
        bankId: "b1",
        bankName: "Galicia",
        currency: "USD",
        balance: 0,
        archived: false,
      },
    ]);

    const rows = await loadSummaryView("user_1", "2026-09", TODAY).summary;

    expect(rows.map(({ currency }) => currency)).toEqual(["ARS", "USD"]);
    expect(rows[0]).toEqual(toSummaryRows([ARS])[0]);
    expect(rows[1].incomes.total).toMatch(/0,00/);
    expect(rows[1].paidPercent).toBe(0);
  });

  it("reads the attention as of today and the charts of the month, for the user", async () => {
    service.getMonthlySummary.mockResolvedValue([]);

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await Promise.all([view.attention, view.charts]);

    expect(attentionReads.readAttentionSources).toHaveBeenCalledWith(
      "user_1",
      TODAY,
    );
    expect(chartReads.readMonthChartSources).toHaveBeenCalledWith(
      "user_1",
      "2026-09",
    );
  });

  it("builds the attention groups from the reads and the accounts, with their links", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    attentionReads.readAttentionSources.mockResolvedValue({
      ...NO_ATTENTION_ROWS,
      plannedExpenses: [
        {
          id: "e1",
          description: "Luz",
          currency: "ARS",
          amount: 150000,
          date: "2026-09-10",
        },
      ],
    });
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a1",
        accountName: "Caja",
        bankId: "b1",
        bankName: "Galicia",
        currency: "ARS",
        balance: -5000,
        archived: false,
      },
    ]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).attention,
    ).resolves.toEqual({
      status: "ok",
      value: [
        expect.objectContaining({
          kind: "overdueExpense",
          href: "/dashboard/expenses?to=2026-09-22&status=PLANNED",
        }),
        expect.objectContaining({ kind: "negativeAccount" }),
      ],
    });
  });

  it("gives no attention group when nothing needs it", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).attention,
    ).resolves.toEqual({ status: "ok", value: [] });
  });

  it("attention fails alone: an error result, while the month's numbers still arrive", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    attentionReads.readAttentionSources.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.attention).resolves.toEqual({ status: "error" });
    await expect(view.summary).resolves.toHaveLength(1);
  });

  it("attention fails when the accounts cannot be read, while 'Por cuenta' just has no rows", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.attention).resolves.toEqual({ status: "error" });
    await expect(view.accountBalances).resolves.toEqual([]);
    await expect(view.summary).resolves.toHaveLength(1);
  });

  it("builds the charts per currency, the daily line starting at the month's Saldo previo", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    chartReads.readMonthChartSources.mockResolvedValue({
      ...NO_CHART_ROWS,
      incomes: [
        {
          currency: "ARS",
          date: new Date("2026-09-10T00:00:00.000Z"),
          status: "SETTLED",
          _sum: { amount: BigInt(100000) },
        },
      ],
    });

    const result = await loadSummaryView("user_1", "2026-09", TODAY).charts;

    if (result.status !== "ok") {
      throw new Error("the charts should have loaded");
    }

    const [ars] = result.value;

    expect(ars.currency).toBe("ARS");
    expect(ars.monthly.map(({ month }) => month)).toEqual(["2026-09"]);
    // From the 1st up to today, the 15th.
    expect(ars.daily).toHaveLength(15);
    expect(ars.daily[8].balance).toBe(500000);
    expect(ars.daily[9].balance).toBe(600000);
  });

  it("draws a flat daily line for a currency held only in an account, so its tab is not told the month has not begun", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "acc_eur",
        bankId: "bank_eur",
        bankName: "Wise",
        accountName: "Euros",
        currency: "EUR",
        balance: 0,
        archived: false,
      },
    ]);

    const result = await loadSummaryView("user_1", "2026-09", TODAY).charts;

    if (result.status !== "ok") {
      throw new Error("the charts should have loaded");
    }

    const eur = result.value.find(({ currency }) => currency === "EUR");

    expect(eur?.daily).toHaveLength(15);
    expect(eur?.daily.every(({ balance }) => balance === 0)).toBe(true);
    // The month's own currency keeps its line, so the new one is an addition, not a replacement.
    expect(
      result.value.find(({ currency }) => currency === "ARS")?.daily,
    ).toHaveLength(15);
  });

  it("charts fail alone: an error result, while the month's numbers still arrive", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    chartReads.readMonthChartSources.mockRejectedValue(new Error("boom"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.charts).resolves.toEqual({ status: "error" });
    await expect(view.summary).resolves.toHaveLength(1);
  });

  it("charts give an error result, not a rejection, when the month's summary fails", async () => {
    service.getMonthlySummary.mockRejectedValue(new Error("database down"));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await expect(view.charts).resolves.toEqual({ status: "error" });
    await expect(view.summary).rejects.toThrow("database down");
  });

  it("lists a negative ARCHIVED account in the attention block too, from the same current-balance read 'Por cuenta' uses", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a_old",
        accountName: "Vieja",
        bankId: "b1",
        bankName: "Galicia",
        currency: "ARS",
        balance: -7000,
        archived: true,
      },
    ]);

    const view = loadSummaryView("user_1", "2026-09", TODAY);
    const result = await view.attention;

    if (result.status !== "ok") {
      throw new Error("the attention block should have loaded");
    }

    const [group] = result.value;

    expect(group.kind).toBe("negativeAccount");
    expect(group.items.map(({ id }) => id)).toEqual(["a_old"]);
    // The very same read that feeds "Por cuenta" (current balances, no upper date), made once.
    expect(accounts.listAccountBalanceRows).toHaveBeenCalledTimes(1);
    expect(accounts.listAccountBalanceRows).toHaveBeenCalledWith("user_1");
    await expect(view.accountBalances).resolves.toEqual([
      expect.objectContaining({
        banks: [
          expect.objectContaining({
            accounts: [expect.objectContaining({ isArchived: true })],
          }),
        ],
      }),
    ]);
  });

  it("does not list an archived account that is not negative (twin of the case above)", async () => {
    service.getMonthlySummary.mockResolvedValue([ARS]);
    accounts.listAccountBalanceRows.mockResolvedValue([
      {
        accountId: "a_old",
        accountName: "Vieja",
        bankId: "b1",
        bankName: "Galicia",
        currency: "ARS",
        balance: 0,
        archived: true,
      },
    ]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).attention,
    ).resolves.toEqual({ status: "ok", value: [] });
  });
});

describe("loadSummaryView hidden currencies", () => {
  it("hands the page the currencies the user hides from the tabs, on their own promise", async () => {
    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: true,
      hiddenSummaryCurrencies: ["USD", "EUR"],
    });
    // The cards never arrive; the list must not depend on them.
    service.getMonthlySummary.mockReturnValue(new Promise(() => {}));

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    expect(view.hiddenCurrencies).toBeInstanceOf(Promise);
    await expect(view.hiddenCurrencies).resolves.toEqual(["USD", "EUR"]);
  });

  it("hands on an empty list when the user hides nothing", async () => {
    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: true,
      hiddenSummaryCurrencies: [],
    });
    service.getMonthlySummary.mockResolvedValue([]);

    await expect(
      loadSummaryView("user_1", "2026-09", TODAY).hiddenCurrencies,
    ).resolves.toEqual([]);
  });

  it("does not filter the figures: a hidden currency keeps its row, its chart line and the account rows", async () => {
    const usd = { ...ARS, currency: "USD" };

    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: true,
      hiddenSummaryCurrencies: ["USD"],
    });
    service.getMonthlySummary.mockResolvedValue([ARS, usd]);

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    expect((await view.summary).map(({ currency }) => currency)).toEqual([
      "ARS",
      "USD",
    ]);
    await expect(view.charts).resolves.toMatchObject({ status: "ok" });
  });

  it("reads the settings only once, shared with the summary and the switch", async () => {
    service.getMonthlySummary.mockResolvedValue([]);
    settings.getUserSettings.mockResolvedValue({
      includeExpectedIncomes: true,
      hiddenSummaryCurrencies: [],
    });

    const view = loadSummaryView("user_1", "2026-09", TODAY);

    await Promise.all([
      view.summary,
      view.includeExpectedIncomes,
      view.hiddenCurrencies,
    ]);

    expect(settings.getUserSettings).toHaveBeenCalledTimes(1);
  });
});
