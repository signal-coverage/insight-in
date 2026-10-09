import { describe, expect, it } from "vitest";

import { parseEntriesQuery } from "@/core/entries/query";
import { formatMoney } from "@/core/incomes/money";
import type { AttentionGroup, MonthCharts } from "@/core/summary/types";

import {
  attentionHref,
  paidPercentOf,
  settleBlock,
  toAccountRows,
  toAttentionRows,
  toChartRows,
  toOpeningBalanceData,
  toSummaryRows,
} from "./utils";

// The es-AR formatter separates the prefix with a no-break space, so a plain space in the
// expectation matches any whitespace.
const money = (text: string) => {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, (char) => `\\${char}`);

  return expect.stringMatching(new RegExp(`^${escaped.replace(/ /g, "\\s")}$`));
};

const ARS = {
  currency: "ARS",
  incomes: { total: 140000, settled: 100000, pending: 40000 },
  expenses: { total: 50000, settled: 30000, pending: 20000 },
  previous: 500000,
  current: 70000,
  target: 90000,
  pendingReimbursements: 400000,
};

describe("toSummaryRows", () => {
  it("formats every amount in its own currency", () => {
    expect(toSummaryRows([ARS])).toEqual([
      {
        currency: "ARS",
        incomes: {
          total: money("$ 1.400,00"),
          settled: money("$ 1.000,00"),
          pending: money("$ 400,00"),
        },
        expenses: {
          total: money("$ 500,00"),
          settled: money("$ 300,00"),
          pending: money("$ 200,00"),
        },
        previous: money("$ 5.000,00"),
        current: money("$ 700,00"),
        target: money("$ 900,00"),
        reimbursements: money("$ 4.000,00"),
        paidPercent: 60,
      },
    ]);
  });

  it("formats a negative remainder with its sign", () => {
    const [row] = toSummaryRows([{ ...ARS, current: -25000, target: -5000 }]);

    expect(row.current).toMatch(/-/);
    expect(row.current).toMatch(/250,00/);
  });

  it("keeps the order and the currencies it is given", () => {
    const rows = toSummaryRows([ARS, { ...ARS, currency: "USD" }]);

    expect(rows.map((row) => row.currency)).toEqual(["ARS", "USD"]);
    expect(rows[1].incomes.total).toMatch(/US\$/);
  });

  it("returns nothing for nothing", () => {
    expect(toSummaryRows([])).toEqual([]);
  });
});

describe("toOpeningBalanceData", () => {
  const ACCOUNTS = [
    {
      accountId: "acc_bank",
      bankId: "bank_galicia",
      bankName: "Banco Galicia",
      accountName: "Caja de ahorro",
      currency: "ARS",
      archived: false,
    },
    {
      accountId: "acc_usd",
      bankId: "bank_galicia",
      bankName: "Banco Galicia",
      accountName: "Dólares",
      currency: "USD",
      archived: false,
    },
    {
      accountId: "acc_cash",
      bankId: "bank_cash",
      bankName: "Efectivo",
      accountName: "Efectivo",
      currency: "ARS",
      archived: false,
    },
    {
      accountId: "acc_old",
      bankId: "bank_cash",
      bankName: "Efectivo",
      accountName: "Vieja",
      currency: "ARS",
      archived: true,
    },
  ];

  it("groups the accounts by bank, in order, numbering every row", () => {
    const { groups } = toOpeningBalanceData({
      opening: null,
      accounts: ACCOUNTS,
    });

    expect(
      groups.map(({ bankName, rows }) => [
        bankName,
        rows.map((row) => row.index),
      ]),
    ).toEqual([
      ["Banco Galicia", [0, 1]],
      ["Efectivo", [2, 3]],
    ]);
  });

  it("keeps two banks apart by id, even with the same name and interleaved accounts", () => {
    const account = (accountId: string, bankId: string) => ({
      accountId,
      bankId,
      bankName: "Banco",
      accountName: accountId,
      currency: "ARS",
      archived: false,
    });
    const { groups } = toOpeningBalanceData({
      opening: null,
      accounts: [
        account("a1", "bank_a"),
        account("b1", "bank_b"),
        account("a2", "bank_a"),
      ],
    });

    expect(
      groups.map(({ bankId, rows }) => [
        bankId,
        rows.map((row) => [row.accountId, row.index]),
      ]),
    ).toEqual([
      [
        "bank_a",
        [
          ["a1", 0],
          ["a2", 2],
        ],
      ],
      ["bank_b", [["b1", 1]]],
    ]);
  });

  it("starts every amount empty, and the month unset, when nothing was saved", () => {
    const data = toOpeningBalanceData({ opening: null, accounts: ACCOUNTS });

    expect(data.month).toBeNull();
    expect(
      data.groups.flatMap(({ rows }) => rows.map((row) => row.amount)),
    ).toEqual(["", "", "", ""]);
  });

  it("prefills each saved amount as plain decimal text, with the month it is valid from", () => {
    const data = toOpeningBalanceData({
      opening: {
        month: "2026-06",
        amounts: [
          { accountId: "acc_bank", currency: "ARS", amount: 500050 },
          { accountId: "acc_old", currency: "ARS", amount: 0 },
        ],
      },
      accounts: ACCOUNTS,
    });

    expect(data.month).toBe("2026-06");
    expect(data.groups[0].rows[0]).toEqual({
      index: 0,
      accountId: "acc_bank",
      currency: "ARS",
      label: "Caja de ahorro (ARS)",
      amount: "5000.50",
    });
    // An explicit zero stays a zero, not an empty field; an archived account says so.
    expect(data.groups[1].rows[1]).toMatchObject({
      label: "Vieja (ARS) · archivada",
      amount: "0.00",
    });
  });
});

describe("toAccountRows", () => {
  it("formats every balance in the currency of its account and flags the negative ones", () => {
    const rows = toAccountRows([
      {
        currency: "USD",
        total: -300,
        banks: [
          {
            bankId: "b1",
            bankName: "Galicia",
            accounts: [
              {
                accountId: "a1",
                accountName: "Dólares",
                bankId: "b1",
                bankName: "Galicia",
                currency: "USD",
                balance: -300,
                archived: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(rows).toEqual([
      {
        currency: "USD",
        totalLabel: formatMoney(-300, "USD"),
        isTotalNegative: true,
        banks: [
          {
            bankId: "b1",
            bankName: "Galicia",
            accounts: [
              {
                accountId: "a1",
                name: "Dólares",
                balanceLabel: formatMoney(-300, "USD"),
                isNegative: true,
                isArchived: false,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("does not flag zero or positive balances", () => {
    const [ars] = toAccountRows([
      {
        currency: "ARS",
        total: 0,
        banks: [
          {
            bankId: "b1",
            bankName: "Efectivo",
            accounts: [
              {
                accountId: "a1",
                accountName: "Efectivo",
                bankId: "b1",
                bankName: "Efectivo",
                currency: "ARS",
                balance: 0,
                archived: false,
              },
            ],
          },
        ],
      },
    ]);

    expect(ars.isTotalNegative).toBe(false);
    expect(ars.banks[0].accounts[0].isNegative).toBe(false);
  });
});

describe("paidPercentOf", () => {
  it("is the share of the total already paid, rounded", () => {
    expect(
      paidPercentOf({ total: 50000, settled: 30000, pending: 20000 }),
    ).toBe(60);
    expect(paidPercentOf({ total: 3, settled: 1, pending: 2 })).toBe(33);
  });

  it("is 0 with nothing to pay, never a division by zero", () => {
    expect(paidPercentOf({ total: 0, settled: 0, pending: 0 })).toBe(0);
  });

  it("never reads 100 while something is still unpaid, even when it rounds up to it", () => {
    expect(paidPercentOf({ total: 1000, settled: 996, pending: 4 })).toBe(99);
  });

  it("reads 100 once everything is paid (twin of the cap above)", () => {
    expect(paidPercentOf({ total: 1000, settled: 1000, pending: 0 })).toBe(100);
  });

  it("never reads 0 once something is paid, even when it rounds down to it", () => {
    expect(paidPercentOf({ total: 1000, settled: 1, pending: 999 })).toBe(1);
  });

  it("reads 0 with nothing paid (twin of the floor above)", () => {
    expect(paidPercentOf({ total: 1000, settled: 0, pending: 1000 })).toBe(0);
  });

  it("never goes past 100", () => {
    expect(paidPercentOf({ total: 100, settled: 150, pending: -50 })).toBe(100);
  });
});

describe("toChartRows", () => {
  const CHARTS: MonthCharts = {
    monthly: [
      {
        currency: "USDC",
        months: [{ month: "2026-09", incomes: 1500000, expenses: 0 }],
      },
      {
        currency: "ARS",
        months: [{ month: "2026-09", incomes: 140000, expenses: 50000 }],
      },
    ],
    categories: [
      {
        currency: "ARS",
        total: 50000,
        categories: [
          { categoryId: "cat_food", name: "Comida", amount: 30000 },
          { categoryId: null, name: "Otras", amount: 20000 },
        ],
      },
    ],
    daily: [
      {
        currency: "ARS",
        points: [
          { date: "2026-09-01", balance: -100 },
          { date: "2026-09-02", balance: 500000 },
        ],
      },
    ],
  };

  it("gives each currency one row, in the app's order, with every chart of it", () => {
    const rows = toChartRows(CHARTS);

    expect(rows.map(({ currency }) => currency)).toEqual(["ARS", "USDC"]);
    expect(rows[1].categories).toEqual([]);
    expect(rows[1].daily).toEqual([]);
  });

  it("formats every label in the row's own currency, crypto included", () => {
    const [ars, usdc] = toChartRows(CHARTS);

    expect(ars.monthly[0]).toEqual({
      month: "2026-09",
      monthLabel: expect.stringMatching(/^sep/i),
      incomes: 140000,
      expenses: 50000,
      incomesLabel: money("$ 1.400,00"),
      expensesLabel: money("$ 500,00"),
    });
    expect(usdc.monthly[0].incomesLabel).toEqual(money("1,50 USDC"));
  });

  it("names each category bar, gives it its share of the total, and marks Otras", () => {
    const [ars] = toChartRows(CHARTS);

    expect(ars.categories).toEqual([
      {
        key: "cat_food",
        name: "Comida",
        amount: 30000,
        amountLabel: money("$ 300,00"),
        shareLabel: "60 %",
        isOther: false,
      },
      {
        key: "other",
        name: "Otras",
        amount: 20000,
        amountLabel: money("$ 200,00"),
        shareLabel: "40 %",
        isOther: true,
      },
    ]);
  });

  it("writes each day short and marks a negative balance", () => {
    const [ars] = toChartRows(CHARTS);

    expect(ars.daily[0]).toEqual({
      date: "2026-09-01",
      dayLabel: "01/09",
      balance: -100,
      balanceLabel: expect.stringMatching(/-.*1,00/),
      isNegative: true,
    });
    expect(ars.daily[1].isNegative).toBe(false);
  });
});

describe("attentionHref", () => {
  const TODAY = "2026-10-08";

  it("sends expenses to the planned ones up to a week ahead, with no lower date", () => {
    expect(attentionHref("overdueExpense", TODAY)).toBe(
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
    expect(attentionHref("upcomingExpense", TODAY)).toBe(
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
  });

  it("sends overdue incomes to the planned ones up to yesterday", () => {
    expect(attentionHref("overdueIncome", TODAY)).toBe(
      "/dashboard/incomes?to=2026-10-07&status=PLANNED",
    );
  });

  it("sends the kinds without a filter to their plain page", () => {
    expect(attentionHref("reimbursement", TODAY)).toBe("/dashboard/incomes");
    expect(attentionHref("negativeAccount", TODAY)).toBe("/dashboard/banks");
    expect(attentionHref("cardLimit", TODAY)).toBe("/dashboard/cards");
  });

  it("every expense and income link parses back into the target page's filter", () => {
    const parse = (href: string) =>
      parseEntriesQuery(
        Object.fromEntries(new URLSearchParams(href.split("?")[1])),
        { today: TODAY },
      );

    expect(parse(attentionHref("overdueExpense", TODAY))).toMatchObject({
      status: "PLANNED",
      from: null,
      to: "2026-10-15",
      currency: null,
      categoryId: null,
    });
    expect(parse(attentionHref("overdueIncome", TODAY))).toMatchObject({
      status: "PLANNED",
      from: null,
      to: "2026-10-07",
    });
  });
});

describe("toAttentionRows", () => {
  const GROUPS: AttentionGroup[] = [
    {
      kind: "overdueExpense",
      hiddenCount: 2,
      items: [
        {
          kind: "overdueExpense",
          id: "e1",
          title: "Luz",
          currency: "ARS",
          amount: 150000,
          limit: null,
          date: "2026-10-01",
          severity: "danger",
        },
      ],
    },
    {
      kind: "cardLimit",
      hiddenCount: 0,
      items: [
        {
          kind: "cardLimit",
          id: "card_1:USD",
          title: "Visa •••• 1234 · Banco Galicia",
          currency: "USD",
          amount: 8500,
          limit: 10000,
          date: null,
          severity: "warning",
        },
      ],
    },
  ];

  it("titles each group, links it to where it is resolved, and keeps the count of the rest", () => {
    const [expenses, cards] = toAttentionRows(GROUPS, "2026-10-08");

    expect(expenses).toMatchObject({
      kind: "overdueExpense",
      title: "Gastos vencidos",
      linkLabel: "Ver gastos",
      href: "/dashboard/expenses?to=2026-10-15&status=PLANNED",
      hiddenCount: 2,
    });
    expect(cards).toMatchObject({
      kind: "cardLimit",
      title: "Tarjetas cerca del tope",
      linkLabel: "Ver Tarjetas",
      href: "/dashboard/cards",
    });
  });

  it("formats each amount in its own currency, with the date of an entry and the cap of a card", () => {
    const [expenses, cards] = toAttentionRows(GROUPS, "2026-10-08");

    expect(expenses.items[0]).toEqual({
      id: "e1",
      title: "Luz",
      amountLabel: money("$ 1.500,00"),
      limitLabel: null,
      dateLabel: expect.stringMatching(/2026/),
      severity: "danger",
    });
    expect(cards.items[0]).toEqual({
      id: "card_1:USD",
      title: "Visa •••• 1234 · Banco Galicia",
      amountLabel: money("US$ 85,00"),
      limitLabel: money("US$ 100,00"),
      dateLabel: null,
      severity: "warning",
    });
  });
});

describe("settleBlock", () => {
  it("hands the value on when the load works", async () => {
    await expect(settleBlock(Promise.resolve([1]))).resolves.toEqual({
      status: "ok",
      value: [1],
    });
  });

  it("turns a failure into an error result instead of rejecting", async () => {
    await expect(
      settleBlock(Promise.reject(new Error("database down"))),
    ).resolves.toEqual({ status: "error" });
  });
});
