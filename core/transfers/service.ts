import { accountLabel } from "@/core/accounts/label";
import { lockAccounts } from "@/core/accounts/locks";
import type { LockedAccount } from "@/core/accounts/locks";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { dateToIsoDate, isoDateToDate, todayIso } from "@/core/incomes/dates";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { monthRange } from "@/core/summary/month";
import { prisma } from "@/infrastructure/db/client";
import type {
  Prisma,
  Transfer as TransferRecord,
} from "@/lib/generated/prisma/client";

import { MAX_TRANSFERS_PER_MONTH } from "./consts";
import {
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";
import { lockTransfers } from "./locks";
import {
  assertTransferAccount,
  giveBacks,
  isFutureDate,
  needsFundsCheck,
  netDeltas,
} from "./rules";
import type { GiveBack } from "./rules";
import type { Transfer, TransferInput } from "./types";

// Every operation is scoped by userId, so one user can never read or change another user's transfers.
//
// The invariant of every write: it may never push an account it takes money from below zero. A
// transfer takes money from its source (create: the source must cover it on the transfer's date and
// also now, so a backdated transfer cannot overdraw today's balance) and, when it is undone, from its
// destination (delete: it must hold the amount now);
// an edit is the old transfer undone and the new one made, compared as a NET change per account (see
// netDeltas / giveBacks in rules.ts). An account that only gains is never checked. Negative balances
// can still arise from other writes (deleting an income, entering an expense): they are shown in red,
// never blocked.

type TransferWithAccounts = TransferRecord & {
  fromAccount: { name: string; currency: string; bank: { name: string } };
  toAccount: { name: string; bank: { name: string } };
};

// What a transfer needs besides its own columns: the label of both accounts and the currency of the
// source (both accounts have the same one), in the same query.
const WITH_ACCOUNTS = {
  fromAccount: {
    select: { name: true, currency: true, bank: { select: { name: true } } },
  },
  toAccount: { select: { name: true, bank: { select: { name: true } } } },
} as const;

const toTransfer = (row: TransferWithAccounts): Transfer => ({
  id: row.id,
  fromAccountId: row.fromAccountId,
  toAccountId: row.toAccountId,
  fromLabel: accountLabel(row.fromAccount.bank.name, row.fromAccount.name),
  toLabel: accountLabel(row.toAccount.bank.name, row.toAccount.name),
  currency: row.fromAccount.currency,
  amount: minorUnitsToNumber(row.amount),
  date: dateToIsoDate(row.date),
  notes: row.notes,
});

// Explicit field list: the owner and the id can never be overridden by the payload. The currency is
// not stored: it is the one of the accounts.
const toWritableData = (input: TransferInput) => ({
  fromAccountId: input.fromAccountId,
  toAccountId: input.toAccountId,
  amount: BigInt(input.amount),
  date: isoDateToDate(input.date),
  notes: input.notes,
});

// The user's transfers of one month ("YYYY-MM"), newest first.
export const listTransfers = async (
  userId: string,
  month: string,
): Promise<Transfer[]> => {
  const { from, to } = monthRange(month);
  const rows = await prisma.transfer.findMany({
    where: {
      userId,
      date: { gte: isoDateToDate(from), lte: isoDateToDate(to) },
    },
    include: WITH_ACCOUNTS,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }, { id: "desc" }],
    take: MAX_TRANSFERS_PER_MONTH,
  });

  return rows.map(toTransfer);
};

// Every account that has to give money back must hold that much NOW (the balance the Banks board shows,
// the transfer being undone included): the one that cannot makes the write fail, naming the account
// and what it holds. All accounts are read in one query, after the locks.
const assertGiveBacks = async (
  tx: Prisma.TransactionClient,
  userId: string,
  due: readonly GiveBack[],
  locked: ReadonlyMap<string, LockedAccount>,
): Promise<void> => {
  if (due.length === 0) {
    return;
  }

  const rows = await readAccountBalances(
    tx,
    userId,
    due.map(({ accountId }) => accountId),
  );
  const heldBy = new Map(
    rows.map(({ accountId, balance }) => [accountId, balance]),
  );

  for (const { accountId, amount } of due) {
    const available = heldBy.get(accountId) ?? 0;

    if (available < amount) {
      const account = await tx.account.findFirst({
        where: { id: accountId, userId },
        select: { name: true, bank: { select: { name: true } } },
      });

      throw new TransferGiveBackError(
        account ? accountLabel(account.bank.name, account.name) : accountId,
        available,
        amount,
        // Every account of a transfer of the user was locked (and so read) by the caller.
        (locked.get(accountId) as LockedAccount).currency,
      );
    }
  }
};

// The transfer an edit replaces, as far as money is concerned.
interface PreviousTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
}

// Everything that must hold for a create or an edit, inside the transaction that will write it: the
// accounts differ; the accounts of the new transfer AND of the old one (an edit) are locked in ascending
// id order, so A to B and B to A never wait for each other and archiving or changing the currency of
// any of them cannot interleave (they take the same row); the new accounts are the user's, in the
// currency of the transfer and active (an edit may keep an archived one on the side it already was);
// the new source held the amount on the transfer's date AND holds it now, without the effect of the
// transfer being replaced (only when the edit asks something new of it); and every other account that
// ends up with less than it has now (the old destination when the amount goes down or the destination
// changes) can still give that much back. The funds are read
// AFTER the locks: under READ COMMITTED every statement sees what the previous holder of the lock
// committed, so two transfers from the same source cannot spend the same money. (Incomes and expenses
// do not take the lock: one saved in the same instant can still land, and the balance then shows it, in
// red if negative.)
const settle = async (
  tx: Prisma.TransactionClient,
  userId: string,
  input: TransferInput,
  previous: PreviousTransfer | null,
): Promise<void> => {
  if (input.fromAccountId === input.toAccountId) {
    throw new TransferSameAccountError();
  }

  const locked = await lockAccounts(tx, userId, [
    input.fromAccountId,
    input.toAccountId,
    ...(previous ? [previous.fromAccountId, previous.toAccountId] : []),
  ]);

  assertTransferAccount(
    "from",
    locked.get(input.fromAccountId) ?? null,
    input.currency,
    previous?.fromAccountId ?? null,
  );
  assertTransferAccount(
    "to",
    locked.get(input.toAccountId) ?? null,
    input.currency,
    previous?.toAccountId ?? null,
  );

  if (needsFundsCheck(previous, input)) {
    // Both reads leave out the transfer being replaced. The source must cover the amount on the
    // transfer's date AND now: a backdated transfer taken out of money that was spent since would
    // push the account below zero today. The message names the lower of the two.
    const [onDate] = await readAccountBalances(
      tx,
      userId,
      [input.fromAccountId],
      { asOf: input.date, excludeTransferId: previous?.id },
    );
    const [now] = await readAccountBalances(tx, userId, [input.fromAccountId], {
      excludeTransferId: previous?.id,
    });
    const available = Math.min(onDate?.balance ?? 0, now?.balance ?? 0);

    if (available < input.amount) {
      throw new TransferInsufficientFundsError(available, input.currency);
    }
  }

  await assertGiveBacks(
    tx,
    userId,
    giveBacks(
      netDeltas(previous ? [previous] : [], [input]),
      input.fromAccountId,
    ),
    locked,
  );
};

const assertNotFuture = (date: string, today: string): void => {
  if (isFutureDate(date, today)) {
    throw new TransferFutureDateError();
  }
};

export const createTransfer = async (
  userId: string,
  input: TransferInput,
  today: string = todayIso(),
): Promise<void> => {
  assertNotFuture(input.date, today);

  await prisma.$transaction(async (tx) => {
    await settle(tx, userId, input, null);
    await tx.transfer.create({ data: { userId, ...toWritableData(input) } });
  });
};

// Returns false when no transfer with that id belongs to the user (nothing else is checked then). The
// order is always: the transfer row is locked, then read, then its accounts (old and new) are locked,
// then the balances are read, then the write. Locking the row before reading it means a concurrent
// edit or delete of the same transfer has finished by then, so the funds are checked against the
// accounts the transfer actually has.
export const updateTransfer = async (
  userId: string,
  id: string,
  input: TransferInput,
  today: string = todayIso(),
): Promise<boolean> => {
  assertNotFuture(input.date, today);

  return prisma.$transaction(async (tx) => {
    await lockTransfers(tx, userId, [id]);

    const current = await tx.transfer.findFirst({
      where: { id, userId },
      select: {
        fromAccountId: true,
        toAccountId: true,
        amount: true,
        date: true,
      },
    });

    if (!current) {
      return false;
    }

    await settle(tx, userId, input, {
      id,
      fromAccountId: current.fromAccountId,
      toAccountId: current.toAccountId,
      amount: minorUnitsToNumber(current.amount),
      date: dateToIsoDate(current.date),
    });

    const { count } = await tx.transfer.updateMany({
      where: { id, userId },
      data: toWritableData(input),
    });

    return count > 0;
  });
};

// Deleting a transfer undoes the money: the source gets the amount back and the destination gives it
// back, so it is allowed only when the destination still holds it (a transfer made by mistake can be
// removed, one whose money was already spent cannot: the destination would go below zero). The source
// only gains, so it is never checked. Both accounts are locked in ascending id order and read after
// the locks, like a create. Several transfers are checked together by the net change of each account
// over the whole selection (so the answer does not depend on the order of the ids), all or nothing.
// Returns how many were deleted: an id that is gone, or is not the user's, simply does not count. Same
// order as an edit: the transfer rows are locked before they are read, so the funds are checked against
// the accounts the transfers actually have, then the accounts are locked, the balances read, and the
// rows deleted.
export const deleteTransfers = async (
  userId: string,
  ids: readonly string[],
): Promise<number> =>
  prisma.$transaction(async (tx) => {
    await lockTransfers(tx, userId, ids);

    const rows = await tx.transfer.findMany({
      where: { id: { in: [...ids] }, userId },
      select: {
        id: true,
        fromAccountId: true,
        toAccountId: true,
        amount: true,
      },
    });

    if (rows.length === 0) {
      return 0;
    }

    const moves = rows.map(({ fromAccountId, toAccountId, amount }) => ({
      fromAccountId,
      toAccountId,
      amount: minorUnitsToNumber(amount),
    }));
    const locked = await lockAccounts(
      tx,
      userId,
      moves.flatMap(({ fromAccountId, toAccountId }) => [
        fromAccountId,
        toAccountId,
      ]),
    );

    await assertGiveBacks(tx, userId, giveBacks(netDeltas(moves, [])), locked);

    const { count } = await tx.transfer.deleteMany({
      where: { id: { in: rows.map(({ id }) => id) }, userId },
    });

    return count;
  });

// Returns false when no transfer with that id belongs to the user.
export const deleteTransfer = async (
  userId: string,
  id: string,
): Promise<boolean> => (await deleteTransfers(userId, [id])) > 0;
