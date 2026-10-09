import { describe, expect, it } from "vitest";

import { summarize } from "./compute";
import {
  buildMonthCharts,
  categoryBreakdown,
  dailyBalance,
  monthlySeries,
} from "./series";
import type { CategoryGroup, DatedGroup, StatusGroup } from "./types";

const day = (
  currency: string,
  date: string,
  status: DatedGroup["status"],
  amount: number,
): DatedGroup => ({
  currency,
  date: new Date(`${date}T00:00:00.000Z`),
  status,
  _sum: { amount: BigInt(amount) },
});

const category = (
  currency: string,
  categoryId: string,
  amount: number,
): CategoryGroup => ({
  currency,
  categoryId,
  _sum: { amount: BigInt(amount) },
});

const MONTHS = ["2026-07", "2026-08", "2026-09"];

describe("monthlySeries", () => {
  it("adds up each month's incomes and expenses, planned and settled alike", () => {
    const series = monthlySeries(
      [
        day("ARS", "2026-09-03", "SETTLED", 1000),
        day("ARS", "2026-09-20", "PLANNED", 500),
        day("ARS", "2026-08-10", "SETTLED", 300),
      ],
      [day("ARS", "2026-09-05", "SETTLED", 200)],
      MONTHS,
    );

    expect(series).toEqual([
      {
        currency: "ARS",
        months: [
          { month: "2026-08", incomes: 300, expenses: 0 },
          { month: "2026-09", incomes: 1500, expenses: 200 },
        ],
      },
    ]);
  });

  it("never counts an installment somebody else covered", () => {
    const [ars] = monthlySeries(
      [],
      [
        day("ARS", "2026-09-05", "SETTLED", 100),
        day("ARS", "2026-09-06", "COVERED", 900),
      ],
      MONTHS,
    );

    expect(ars.months).toEqual([
      { month: "2026-09", incomes: 0, expenses: 100 },
    ]);
  });

  it("never adds currencies together: one series each, in the app's order", () => {
    const series = monthlySeries(
      [
        day("USDC", "2026-09-01", "SETTLED", 1500000),
        day("USD", "2026-09-01", "SETTLED", 50),
        day("ARS", "2026-09-01", "SETTLED", 1000),
      ],
      [],
      MONTHS,
    );

    expect(series.map(({ currency }) => currency)).toEqual([
      "ARS",
      "USD",
      "USDC",
    ]);
    expect(series[1].months).toEqual([
      { month: "2026-09", incomes: 50, expenses: 0 },
    ]);
  });

  it("starts at the first month with something, and keeps an empty month in between at zero", () => {
    const [ars] = monthlySeries(
      [
        day("ARS", "2026-07-01", "SETTLED", 10),
        day("ARS", "2026-09-01", "SETTLED", 30),
      ],
      [],
      MONTHS,
    );

    expect(ars.months.map(({ month }) => month)).toEqual(MONTHS);
    expect(ars.months[1]).toEqual({
      month: "2026-08",
      incomes: 0,
      expenses: 0,
    });
  });

  it("leaves out what falls outside the months asked for, and keeps what falls inside", () => {
    const [ars] = monthlySeries(
      [
        day("ARS", "2026-06-30", "SETTLED", 999),
        day("ARS", "2026-09-01", "SETTLED", 1),
      ],
      [],
      MONTHS,
    );

    expect(ars.months).toEqual([{ month: "2026-09", incomes: 1, expenses: 0 }]);
  });

  it("gives no series to a currency whose sums are empty", () => {
    const empty: DatedGroup = {
      currency: "EUR",
      date: new Date("2026-09-01T00:00:00.000Z"),
      status: "SETTLED",
      _sum: { amount: null },
    };

    expect(monthlySeries([empty], [], MONTHS)).toEqual([]);
    expect(
      monthlySeries([day("EUR", "2026-09-01", "SETTLED", 5)], [], MONTHS),
    ).toHaveLength(1);
  });
});

describe("categoryBreakdown", () => {
  const NAMES = new Map([
    ["cat_food", "Comida"],
    ["cat_rent", "Alquiler"],
    ["cat_fun", "Salidas"],
  ]);

  it("sorts the categories by amount, largest first, with their names and the total", () => {
    expect(
      categoryBreakdown(
        [
          category("ARS", "cat_food", 300),
          category("ARS", "cat_rent", 900),
          category("ARS", "cat_fun", 100),
        ],
        NAMES,
      ),
    ).toEqual([
      {
        currency: "ARS",
        total: 1300,
        categories: [
          { categoryId: "cat_rent", name: "Alquiler", amount: 900 },
          { categoryId: "cat_food", name: "Comida", amount: 300 },
          { categoryId: "cat_fun", name: "Salidas", amount: 100 },
        ],
      },
    ]);
  });

  it("breaks a tie by name", () => {
    const [ars] = categoryBreakdown(
      [category("ARS", "cat_fun", 100), category("ARS", "cat_food", 100)],
      NAMES,
    );

    expect(ars.categories.map(({ name }) => name)).toEqual([
      "Comida",
      "Salidas",
    ]);
  });

  it("breaks a tie of amount and name by category id, whatever order they arrive in", () => {
    const names = new Map([
      ["cat_b", "Salidas"],
      ["cat_a", "Salidas"],
    ]);
    const forward = categoryBreakdown(
      [category("ARS", "cat_b", 100), category("ARS", "cat_a", 100)],
      names,
    );
    const backward = categoryBreakdown(
      [category("ARS", "cat_a", 100), category("ARS", "cat_b", 100)],
      names,
    );

    expect(forward[0].categories.map(({ categoryId }) => categoryId)).toEqual([
      "cat_a",
      "cat_b",
    ]);
    expect(backward[0].categories.map(({ categoryId }) => categoryId)).toEqual([
      "cat_a",
      "cat_b",
    ]);
  });

  it("folds everything after the sixth into Otras when there are eight or more, whatever order they arrive in", () => {
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8"];
    const names = new Map(ids.map((id) => [id, `Categoría ${id}`]));
    // Smallest first: the fold must still pick the two smallest, not the last two that arrived.
    const [ars] = categoryBreakdown(
      ids.map((id, index) => category("ARS", id, (8 - index) * 100)).reverse(),
      names,
    );

    expect(ars.categories).toHaveLength(7);
    expect(
      ars.categories.slice(0, 6).map(({ categoryId }) => categoryId),
    ).toEqual(["c1", "c2", "c3", "c4", "c5", "c6"]);
    expect(ars.categories[6]).toEqual({
      categoryId: null,
      name: "Otras",
      amount: 300,
    });
    expect(ars.total).toBe(3600);
  });

  it("keeps seven categories as they are: an Otras of one would hide its name", () => {
    const ids = ["c1", "c2", "c3", "c4", "c5", "c6", "c7"];
    const names = new Map(ids.map((id) => [id, `Categoría ${id}`]));
    const [ars] = categoryBreakdown(
      ids.map((id, index) => category("ARS", id, (7 - index) * 100)).reverse(),
      names,
    );

    expect(ars.categories).toHaveLength(7);
    expect(ars.categories[6]).toEqual({
      categoryId: "c7",
      name: "Categoría c7",
      amount: 100,
    });
    expect(ars.categories.map(({ name }) => name)).not.toContain("Otras");
  });

  it("gives each currency its own list, never mixed", () => {
    const lists = categoryBreakdown(
      [category("USD", "cat_food", 7), category("ARS", "cat_food", 300)],
      NAMES,
    );

    expect(lists.map(({ currency, total }) => [currency, total])).toEqual([
      ["ARS", 300],
      ["USD", 7],
    ]);
  });

  it("drops a category with nothing in it, and keeps one with something", () => {
    const empty: CategoryGroup = {
      currency: "ARS",
      categoryId: "cat_fun",
      _sum: { amount: null },
    };
    const [ars] = categoryBreakdown(
      [empty, category("ARS", "cat_food", 300)],
      NAMES,
    );

    expect(ars.categories.map(({ categoryId }) => categoryId)).toEqual([
      "cat_food",
    ]);
  });
});

describe("dailyBalance", () => {
  const DAYS = ["2026-09-01", "2026-09-02", "2026-09-03"];

  it("starts from the previous balance, adds each day's settled incomes and takes its settled expenses", () => {
    expect(
      dailyBalance(
        [{ currency: "ARS", amount: 1000 }],
        [day("ARS", "2026-09-02", "SETTLED", 500)],
        [day("ARS", "2026-09-03", "SETTLED", 300)],
        DAYS,
      ),
    ).toEqual([
      {
        currency: "ARS",
        points: [
          { date: "2026-09-01", balance: 1000 },
          { date: "2026-09-02", balance: 1500 },
          { date: "2026-09-03", balance: 1200 },
        ],
      },
    ]);
  });

  it("never moves on planned or covered money", () => {
    const [ars] = dailyBalance(
      [{ currency: "ARS", amount: 1000 }],
      [
        day("ARS", "2026-09-02", "PLANNED", 400),
        day("ARS", "2026-09-02", "SETTLED", 1),
      ],
      [day("ARS", "2026-09-03", "COVERED", 900)],
      DAYS,
    );

    expect(ars.points.map(({ balance }) => balance)).toEqual([
      1000, 1001, 1001,
    ]);
  });

  it("draws one line per currency, in the app's order, also for one with only a previous balance", () => {
    const lines = dailyBalance(
      [{ currency: "USD", amount: 50 }],
      [day("ARS", "2026-09-01", "SETTLED", 10)],
      [],
      DAYS,
    );

    expect(lines.map(({ currency }) => currency)).toEqual(["ARS", "USD"]);
    expect(lines[1].points.map(({ balance }) => balance)).toEqual([50, 50, 50]);
  });

  it("has no point for a month that has not started, but still names the currency", () => {
    const lines = dailyBalance([{ currency: "ARS", amount: 10 }], [], [], []);

    expect(lines).toHaveLength(1);
    expect(lines[0].points).toEqual([]);
  });

  it("ignores what moved outside the days shown (earlier months of the chart's read, or after today)", () => {
    const [ars] = dailyBalance(
      [{ currency: "ARS", amount: 0 }],
      [
        day("ARS", "2026-08-31", "SETTLED", 7),
        day("ARS", "2026-09-20", "SETTLED", 9),
        day("ARS", "2026-09-01", "SETTLED", 1),
      ],
      [],
      DAYS,
    );

    expect(ars.points.map(({ balance }) => balance)).toEqual([1, 1, 1]);
  });
});

describe("buildMonthCharts", () => {
  it("agrees with the month's figures: the viewed month's bars are Ingresos and Gastos Total, the categories add up to Gastos Total, and the line ends at Actual once the month is over", () => {
    const incomes = [
      day("ARS", "2026-08-20", "SETTLED", 7000),
      day("ARS", "2026-09-05", "SETTLED", 100000),
      day("ARS", "2026-09-25", "PLANNED", 40000),
    ];
    const expenses = [
      day("ARS", "2026-09-10", "SETTLED", 30000),
      day("ARS", "2026-09-28", "PLANNED", 20000),
      day("ARS", "2026-09-12", "COVERED", 5000),
    ];
    // The same September as the month's summary reads it: by currency and status.
    const incomeGroups: StatusGroup[] = [
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(100000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(40000) } },
    ];
    const expenseGroups: StatusGroup[] = [
      { currency: "ARS", status: "SETTLED", _sum: { amount: BigInt(30000) } },
      { currency: "ARS", status: "PLANNED", _sum: { amount: BigInt(20000) } },
      { currency: "ARS", status: "COVERED", _sum: { amount: BigInt(5000) } },
    ];
    const summary = summarize(incomeGroups, expenseGroups, {
      previous: [{ currency: "ARS", amount: 500000 }],
    });
    const [ars] = summary;

    const charts = buildMonthCharts(
      {
        incomes,
        expenses,
        categories: [
          category("ARS", "cat_food", 30000),
          category("ARS", "cat_rent", 20000),
        ],
        categoryNames: [
          { id: "cat_food", name: "Comida" },
          { id: "cat_rent", name: "Alquiler" },
        ],
      },
      summary,
      "2026-09",
      "2026-10-08",
    );

    const months = charts.monthly[0].months;
    const points = charts.daily[0].points;

    expect(months[months.length - 1]).toEqual({
      month: "2026-09",
      incomes: ars.incomes.total,
      expenses: ars.expenses.total,
    });
    expect(months[0]).toEqual({ month: "2026-08", incomes: 7000, expenses: 0 });
    expect(charts.categories[0].total).toBe(ars.expenses.total);
    expect(points).toHaveLength(30);
    expect(points[points.length - 1].balance).toBe(ars.current);
    expect(points[0].balance).toBe(ars.previous);
  });
});
