import { compareCurrencyCodes } from "@/core/currencies/crypto";

import type {
  AccountAmount,
  AccountBalance,
  AccountFlow,
  AccountOpening,
  CurrencyBalance,
} from "./types";
import { priorEntriesWindow } from "./window";

// The one place that turns money into balances. Every balance of the app (the summary, the Banks
// board, the archive rule, the transfers' funds check, the "Por cuenta" card) is built here, so a
// currency's total is always the sum of its accounts. A transfer is two flows (one out of the source,
// one into the destination) of the same amount and currency, so it can never alter a currency total.

const signed = ({ kind, amount }: AccountFlow): number =>
  kind === "income" || kind === "transferIn" ? amount : -amount;

// Opening amounts plus settled flows, per account. The caller decides which flows count (see
// previousAccountBalances); an account appears when it has an opening amount (even 0) or a flow.
export const sumAccountBalances = (
  amounts: readonly AccountAmount[],
  flows: readonly AccountFlow[],
): AccountBalance[] => {
  const balances = new Map<string, AccountBalance>();
  const add = (accountId: string, currency: string, amount: number) => {
    const current = balances.get(accountId) ?? {
      accountId,
      currency,
      balance: 0,
    };

    balances.set(accountId, { ...current, balance: current.balance + amount });
  };

  for (const { accountId, currency, amount } of amounts) {
    add(accountId, currency, amount);
  }

  for (const flow of flows) {
    add(flow.accountId, flow.currency, signed(flow));
  }

  return [...balances.values()].sort((a, b) =>
    a.accountId.localeCompare(b.accountId),
  );
};

// What each account held at the start of `month`. `flows` are the settled entries of
// priorEntriesWindow(month, opening?.month); they are ignored when that window is empty.
// - no opening balance: the net of every settled entry before the month;
// - a month before the opening one: nothing (no balance is invented);
// - the opening month: the opening amounts;
// - a later month: the opening amounts plus the settled entries since the opening month began.
export const previousAccountBalances = (
  month: string,
  opening: AccountOpening | null,
  flows: readonly AccountFlow[],
): AccountBalance[] => {
  if (opening !== null && month < opening.month) {
    return [];
  }

  const counted =
    priorEntriesWindow(month, opening?.month ?? null) === null ? [] : flows;

  return sumAccountBalances(opening?.amounts ?? [], counted);
};

// The total of each currency: the sum of its accounts. Currencies are never added together.
export const totalsByCurrency = (
  balances: readonly AccountBalance[],
): CurrencyBalance[] => {
  const totals = new Map<string, number>();

  for (const { currency, balance } of balances) {
    totals.set(currency, (totals.get(currency) ?? 0) + balance);
  }

  return [...totals]
    .map(([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => compareCurrencyCodes(a.currency, b.currency));
};
