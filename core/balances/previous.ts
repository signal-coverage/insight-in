import { shiftMonth, monthRange } from "@/core/summary/month";

import type {
  OpeningBalances,
  PreviousBalance,
  PriorWindow,
  SettledFlow,
} from "./types";

// Which days' settled entries add up to the previous balance of `month`, or null when none do
// (the opening balance does not reach back before its month, and in its own month it is the
// starting point itself). Without an opening balance everything before the month counts.
export const priorEntriesWindow = (
  month: string,
  openingMonth: string | null,
): PriorWindow | null => {
  if (openingMonth !== null && month <= openingMonth) {
    return null;
  }

  return {
    from: openingMonth === null ? null : monthRange(openingMonth).from,
    to: monthRange(shiftMonth(month, -1)).to,
  };
};

const emptyBalance = (currency: string): PreviousBalance => ({
  currency,
  digital: 0,
  cash: 0,
});

const MEDIUM_KEYS = { DIGITAL: "digital", CASH: "cash" } as const;

// The "saldo previo" of `month`, per currency, digital and cash apart. `flows` are the settled
// entries of `priorEntriesWindow(month, opening?.month)`; they are ignored when that window is empty.
//
// - no opening balance: the net of every settled entry before the month;
// - month before the opening one: nothing (no balance is invented);
// - the opening month: the opening amounts;
// - a later month: the opening amounts plus the net of the settled entries since.
//
// A currency shows up when it has an opening amount or a balance that is not zero.
export const previousBalances = (
  month: string,
  opening: OpeningBalances | null,
  flows: readonly SettledFlow[],
): PreviousBalance[] => {
  if (opening !== null && month < opening.month) {
    return [];
  }

  const balances = new Map<string, PreviousBalance>();
  const forCurrency = (currency: string): PreviousBalance => {
    const current = balances.get(currency) ?? emptyBalance(currency);

    balances.set(currency, current);

    return current;
  };
  const keep = new Set<string>();

  for (const { currency, medium, amount } of opening?.amounts ?? []) {
    forCurrency(currency)[MEDIUM_KEYS[medium]] += amount;
    keep.add(currency);
  }

  if (priorEntriesWindow(month, opening?.month ?? null) !== null) {
    for (const { currency, medium, kind, amount } of flows) {
      forCurrency(currency)[MEDIUM_KEYS[medium]] +=
        kind === "income" ? amount : -amount;
    }
  }

  return [...balances.values()]
    .filter(
      (balance) =>
        keep.has(balance.currency) ||
        balance.digital !== 0 ||
        balance.cash !== 0,
    )
    .sort((a, b) => a.currency.localeCompare(b.currency));
};
