import type { PreviousBalance } from "@/core/balances/types";
import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { dateToIsoDate } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { DISPLAY_LOCALE } from "@/lib/locale";

import {
  CATEGORY_TOP_COUNT,
  CHART_MONTHS,
  OTHER_CATEGORIES_NAME,
  UNNAMED_CATEGORY_NAME,
} from "./consts";
import { chartDays, lastMonths } from "./days";
import { monthOf } from "./month";
import type {
  CategoryAmount,
  CategoryGroup,
  CurrencyCategories,
  CurrencyDailyBalance,
  CurrencyMonthlySeries,
  CurrencySummary,
  DatedGroup,
  MonthChartSources,
  MonthCharts,
  MonthTotals,
} from "./types";

// The charts of the summary, per currency (currencies are never added together). Pure: they work on
// the grouped rows the chart read returns, so every rule here is the summary's own: a month's "Total"
// counts PLANNED and SETTLED (COVERED never moved money) and a balance moves only on SETTLED money.

const amountOf = (group: { _sum: { amount: bigint | null } }): number =>
  group._sum.amount === null ? 0 : minorUnitsToNumber(group._sum.amount);

const byCurrencyOrder = <T extends { currency: string }>(a: T, b: T): number =>
  compareCurrencyCodes(a.currency, b.currency);

// Each month's incomes and expenses "Total" per currency, for the months given (oldest first). A
// currency starts at its first month with something; an empty month after it shows at zero.
export const monthlySeries = (
  incomes: readonly DatedGroup[],
  expenses: readonly DatedGroup[],
  months: readonly string[],
): CurrencyMonthlySeries[] => {
  const byCurrency = new Map<string, Map<string, MonthTotals>>();

  const add = (
    groups: readonly DatedGroup[],
    side: "incomes" | "expenses",
  ): void => {
    for (const group of groups) {
      const month = monthOf(dateToIsoDate(group.date));
      const amount = amountOf(group);

      if (
        group.status === "COVERED" ||
        amount === 0 ||
        !months.includes(month)
      ) {
        continue;
      }

      const totals =
        byCurrency.get(group.currency) ??
        new Map(
          months.map((each) => [
            each,
            { month: each, incomes: 0, expenses: 0 },
          ]),
        );
      const row = totals.get(month);

      if (row) {
        row[side] += amount;
      }

      byCurrency.set(group.currency, totals);
    }
  };

  add(incomes, "incomes");
  add(expenses, "expenses");

  return [...byCurrency.entries()]
    .map(([currency, totals]) => {
      const rows = months.flatMap((month) => {
        const row = totals.get(month);

        return row ? [row] : [];
      });
      const first = rows.findIndex(
        ({ incomes: inflow, expenses: outflow }) =>
          inflow !== 0 || outflow !== 0,
      );

      return { currency, months: first === -1 ? [] : rows.slice(first) };
    })
    .filter(({ months: rows }) => rows.length > 0)
    .sort(byCurrencyOrder);
};

// The month's expenses per category, per currency, largest first (a tie goes by name). With more than
// one category beyond `top`, those fold into "Otras"; a single one keeps its own name.
export const categoryBreakdown = (
  groups: readonly CategoryGroup[],
  names: ReadonlyMap<string, string>,
  top: number = CATEGORY_TOP_COUNT,
): CurrencyCategories[] => {
  const byCurrency = new Map<string, CategoryAmount[]>();

  for (const group of groups) {
    const amount = amountOf(group);

    if (amount === 0) {
      continue;
    }

    byCurrency.set(group.currency, [
      ...(byCurrency.get(group.currency) ?? []),
      {
        categoryId: group.categoryId,
        name: names.get(group.categoryId) ?? UNNAMED_CATEGORY_NAME,
        amount,
      },
    ]);
  }

  return [...byCurrency.entries()]
    .map(([currency, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          b.amount - a.amount ||
          a.name.localeCompare(b.name, DISPLAY_LOCALE) ||
          (a.categoryId ?? "").localeCompare(b.categoryId ?? ""),
      );
      const total = sorted.reduce((sum, { amount }) => sum + amount, 0);

      if (sorted.length <= top + 1) {
        return { currency, total, categories: sorted };
      }

      const rest = sorted.slice(top);

      return {
        currency,
        total,
        categories: [
          ...sorted.slice(0, top),
          {
            categoryId: null,
            name: OTHER_CATEGORIES_NAME,
            amount: rest.reduce((sum, { amount }) => sum + amount, 0),
          },
        ],
      };
    })
    .sort(byCurrencyOrder);
};

// What the accounts of each currency held at the end of each of `days`: the previous balance plus the
// settled incomes and minus the settled expenses up to that day. A currency with a previous balance or
// a settled movement in those days gets a line, even with no day to show.
export const dailyBalance = (
  previous: readonly PreviousBalance[],
  incomes: readonly DatedGroup[],
  expenses: readonly DatedGroup[],
  days: readonly string[],
): CurrencyDailyBalance[] => {
  const shown = new Set(days);
  const moves = new Map<string, Map<string, number>>();

  const add = (groups: readonly DatedGroup[], sign: 1 | -1): void => {
    for (const group of groups) {
      const date = dateToIsoDate(group.date);

      if (group.status !== "SETTLED" || !shown.has(date)) {
        continue;
      }

      const byDay = moves.get(group.currency) ?? new Map<string, number>();

      byDay.set(date, (byDay.get(date) ?? 0) + sign * amountOf(group));
      moves.set(group.currency, byDay);
    }
  };

  add(incomes, 1);
  add(expenses, -1);

  const currencies = [
    ...new Set([...previous.map(({ currency }) => currency), ...moves.keys()]),
  ].sort(compareCurrencyCodes);

  return currencies.map((currency) => {
    let balance =
      previous.find((row) => row.currency === currency)?.amount ?? 0;
    const byDay = moves.get(currency);

    return {
      currency,
      points: days.map((date) => {
        balance += byDay?.get(date) ?? 0;

        return { date, balance };
      }),
    };
  });
};

// The three charts of `month`, from the chart read and the month's own summary (its "Saldo previo" is
// where the daily line starts).
export const buildMonthCharts = (
  { incomes, expenses, categories, categoryNames }: MonthChartSources,
  summary: readonly CurrencySummary[],
  month: string,
  today: string,
): MonthCharts => ({
  monthly: monthlySeries(incomes, expenses, lastMonths(month, CHART_MONTHS)),
  categories: categoryBreakdown(
    categories,
    new Map(categoryNames.map(({ id, name }) => [id, name])),
  ),
  daily: dailyBalance(
    summary.map(({ currency, previous }) => ({ currency, amount: previous })),
    incomes,
    expenses,
    chartDays(month, today),
  ),
});
