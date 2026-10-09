import type { LockedAccount } from "@/core/accounts/locks";

import { TransferAccountError } from "./errors";
import type { TransferSide } from "./errors";

// Pure rules of a transfer, apart from the service so they are tested without a database.

// ISO dates compare as text.
export const isFutureDate = (date: string, today: string): boolean =>
  date > today;

// What a transfer asks of its source account.
export interface FundsClaim {
  fromAccountId: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD".
  date: string;
}

// A new transfer always asks for funds. An edit asks again only when it asks something new of the
// source: another source, another day (the balance of that day may be lower) or a higher amount. A
// change of destination or notes, or a lower amount on the same source and day, keeps the claim the
// source already honoured, so an old transfer can always be annotated.
export const needsFundsCheck = (
  previous: FundsClaim | null,
  next: FundsClaim,
): boolean =>
  previous === null ||
  previous.fromAccountId !== next.fromAccountId ||
  previous.date !== next.date ||
  next.amount > previous.amount;

// The same rule as assertUsableAccount, applied to an account that was just read under its row lock:
// it must be the user's, in the currency of the transfer, and active. An edit may keep the account the
// transfer already has (`keepAccountId`) even if it was archived since; it can never move to an
// archived one.
export const assertTransferAccount = (
  side: TransferSide,
  account: LockedAccount | null,
  currency: string,
  keepAccountId: string | null,
): void => {
  if (account === null) {
    throw new TransferAccountError(side, "NOT_FOUND");
  }

  if (account.currency !== currency) {
    throw new TransferAccountError(side, "CURRENCY_MISMATCH");
  }

  if (account.archivedAt !== null && account.id !== keepAccountId) {
    throw new TransferAccountError(side, "ARCHIVED");
  }
};

// One transfer as far as money is concerned.
export interface TransferMove {
  fromAccountId: string;
  toAccountId: string;
  // Minor units.
  amount: number;
}

// What a write changes in each account, in minor units. A transfer takes its amount out of the source
// and puts it into the destination; the transfers a write takes away have that effect reversed (the
// source gets the amount back, the destination gives it back) and the ones it adds have it applied. The
// net per account is what matters: an edit that keeps the destination and lowers the amount only takes
// the difference from it, and an edit that changes nothing in the money (its notes) changes nothing.
// An account whose net change is zero is absent.
export const netDeltas = (
  removed: readonly TransferMove[],
  added: readonly TransferMove[],
): Map<string, number> => {
  const deltas = new Map<string, number>();
  const add = (accountId: string, amount: number) =>
    deltas.set(accountId, (deltas.get(accountId) ?? 0) + amount);

  for (const move of removed) {
    add(move.fromAccountId, move.amount);
    add(move.toAccountId, -move.amount);
  }

  for (const move of added) {
    add(move.fromAccountId, -move.amount);
    add(move.toAccountId, move.amount);
  }

  return new Map([...deltas].filter(([, delta]) => delta !== 0));
};

export interface GiveBack {
  accountId: string;
  // Minor units the account ends up with less than it has now.
  amount: number;
}

// The accounts that end up with less than they hold now, and by how much, sorted by account id in plain
// code-unit order (the order accounts are locked in, so an error names them the same way): each
// must still hold that much now, or the write would push it below zero. An account that only gains is
// never listed. `except` is the account the new transfer leaves from: its funds are checked on the
// transfer's own date, without the effect of the transfer being replaced, so it is not checked here.
export const giveBacks = (
  deltas: ReadonlyMap<string, number>,
  except: string | null = null,
): GiveBack[] =>
  [...deltas]
    .filter(([accountId, delta]) => delta < 0 && accountId !== except)
    .map(([accountId, delta]) => ({ accountId, amount: -delta }))
    .sort((a, b) =>
      a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0,
    );
