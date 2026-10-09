import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { CURRENCY_PARAM, MONTH_PARAM } from "../../consts";
import type { CurrencyChartsRow } from "../../types";

// The tab to show: the chosen currency when it has a tab, otherwise the first one (ARS when present).
export const resolveCurrency = (
  selected: string | null,
  currencies: readonly string[],
): string =>
  selected !== null && currencies.includes(selected)
    ? selected
    : (currencies[0] ?? DEFAULT_CURRENCY_CODE);

// What the address carries for a tab: nothing for ARS (the default), `currency=CODE` for any other.
export const currencyParams = (
  currency: string | null,
): Record<string, string> =>
  currency === null || currency === DEFAULT_CURRENCY_CODE
    ? {}
    : { [CURRENCY_PARAM]: currency };

// The charts of one currency, or empty charts when it has nothing to draw.
export const chartsFor = (
  charts: readonly CurrencyChartsRow[],
  currency: string,
): CurrencyChartsRow =>
  charts.find((row) => row.currency === currency) ?? {
    currency,
    monthly: [],
    categories: [],
    daily: [],
  };

// The address after a tab is picked: the current one with only the currency changed (ARS, the default,
// is not written) and the month the page shows kept; every other parameter and the hash stay.
export const tabAddress = (
  location: Pick<Location, "pathname" | "search" | "hash">,
  month: string,
  currentMonth: string,
  currency: string,
): string => {
  const search = new URLSearchParams(location.search);

  if (month === currentMonth) search.delete(MONTH_PARAM);
  else search.set(MONTH_PARAM, month);

  const next = currencyParams(currency)[CURRENCY_PARAM];

  if (next === undefined) search.delete(CURRENCY_PARAM);
  else search.set(CURRENCY_PARAM, next);

  const query = search.toString();

  return `${location.pathname}${query ? `?${query}` : ""}${location.hash}`;
};
