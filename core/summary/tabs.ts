import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { EMPTY_SIDE } from "./consts";
import type { CurrencySummary } from "./types";

// The currencies of the month block's tabs: the month's own and every currency the user holds an
// account in, ARS first, then the app's order (legal tender by code, then crypto). Never empty: with
// nothing at all the month shows ARS at zero.
export const tabCurrencies = (
  summaryCurrencies: readonly string[],
  accountCurrencies: readonly string[],
): string[] => {
  const codes = [...new Set([...summaryCurrencies, ...accountCurrencies])].sort(
    compareCurrencyCodes,
  );

  if (codes.length === 0) {
    return [DEFAULT_CURRENCY_CODE];
  }

  return codes.includes(DEFAULT_CURRENCY_CODE)
    ? [
        DEFAULT_CURRENCY_CODE,
        ...codes.filter((code) => code !== DEFAULT_CURRENCY_CODE),
      ]
    : codes;
};

// The tabs the user chose to show: the rows without the hidden currencies, in the same order. A
// hidden code the user has no tab for is ignored, and when every tab would be hidden (stale data) all
// of them show, so the block never ends up with no currency.
export const visibleTabs = <Row extends { currency: string }>(
  rows: readonly Row[],
  hidden: readonly string[],
): Row[] => {
  const visible = rows.filter(({ currency }) => !hidden.includes(currency));

  return visible.length > 0 ? visible : [...rows];
};

// A currency with nothing in the month: every figure at zero.
export const zeroSummary = (currency: string): CurrencySummary => ({
  currency,
  incomes: { ...EMPTY_SIDE },
  expenses: { ...EMPTY_SIDE },
  previous: 0,
  current: 0,
  target: 0,
  pendingReimbursements: 0,
});

// One summary per tab, in the tabs' order. The rows the month's summary computed are handed on as they
// are (the very same objects); only a tab without one gets a row at zero.
export const summariesForTabs = (
  summary: readonly CurrencySummary[],
  accountCurrencies: readonly string[],
): CurrencySummary[] => {
  const byCurrency = new Map(summary.map((row) => [row.currency, row]));

  return tabCurrencies(
    summary.map(({ currency }) => currency),
    accountCurrencies,
  ).map((currency) => byCurrency.get(currency) ?? zeroSummary(currency));
};

// The currency the address asks for (`?currency=usd` reads "USD"), or null when it asks for none or
// for two. Whether the user has such a tab is decided by the month block.
export const parseCurrencyParam = (
  value: string | string[] | undefined,
): string | null =>
  typeof value === "string" && value.trim() !== ""
    ? value.trim().toUpperCase()
    : null;

// The sections of the overview page, in the order of its tabs. The first is the default one.
export const SUMMARY_SECTIONS = ["accounts", "month", "history"] as const;

export type SummarySection = (typeof SUMMARY_SECTIONS)[number];

export const DEFAULT_SECTION: SummarySection = SUMMARY_SECTIONS[0];

// The section the address asks for (`?section=month`): the default one when it asks for none, for an
// unknown one or for several.
export const parseSectionParam = (
  value: string | string[] | undefined,
): SummarySection =>
  SUMMARY_SECTIONS.find((section) => section === value) ?? DEFAULT_SECTION;
