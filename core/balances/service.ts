import { ensureDefaultCash } from "@/core/accounts/defaultCash";
import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import { lockAccountsShared } from "@/core/accounts/locks";
import { ACCOUNTS_IN_BOARD_ORDER } from "@/core/accounts/order";
import { minorUnitsToNumber } from "@/core/incomes/money";
import { prisma } from "@/infrastructure/db/client";
import type { Prisma } from "@/lib/generated/prisma/client";

import type { OpeningBalanceInput } from "./schema";
import type { OpeningBalanceEditorData, OpeningBalances } from "./types";

type OpeningReader = Pick<Prisma.TransactionClient, "openingBalance">;

// The user's opening balance, or null when they never set one (the balances then accumulate from
// their first entry). Every row shares the one month; the currency is the account's. Any client
// can read it, so the archive rule reads it inside the transaction that locks the account.
export const getOpeningBalances = async (
  userId: string,
  db: OpeningReader = prisma,
): Promise<OpeningBalances | null> => {
  const rows = await db.openingBalance.findMany({
    where: { userId },
    include: { account: { select: { currency: true } } },
  });

  if (rows.length === 0) {
    return null;
  }

  return {
    month: rows[0].month,
    amounts: rows.map((row) => ({
      accountId: row.accountId,
      currency: row.account.currency,
      amount: minorUnitsToNumber(row.amount),
    })),
  };
};

// Replaces the user's opening balance with the amounts given, all valid from the same month. The
// client sends account ids and currencies, so neither is trusted: every account must be the user's
// and in the currency of its row, or nothing is written. Each amount is created or updated, and any
// other row of the user is removed, so whatever was cleared stops counting. One transaction, so the
// rows never end up with different months.
//
// The payload's accounts are locked FOR SHARE before they are read, in ascending id order (the order
// every multi-account writer uses), so a concurrent `updateAccount` (which takes the row FOR NO KEY UPDATE to
// count movements and change the currency) cannot slip between the currency check below and the
// writes: it waits for this transaction, or this one waits for it and then reads the new currency and
// refuses the stale row.
export const saveOpeningBalances = async (
  userId: string,
  { month, amounts }: OpeningBalanceInput,
): Promise<void> => {
  await prisma.$transaction(async (tx) => {
    const accountIds = amounts.map(({ accountId }) => accountId);

    await lockAccountsShared(tx, userId, accountIds);

    if (accountIds.length > 0) {
      const accounts = await tx.account.findMany({
        where: { userId, id: { in: accountIds } },
        select: { id: true, currency: true },
      });
      const currencyOf = new Map(
        accounts.map(({ id, currency }) => [id, currency]),
      );

      for (const { accountId, currency } of amounts) {
        const owned = currencyOf.get(accountId);

        if (owned === undefined) {
          throw new AccountNotFoundError();
        }

        if (owned !== currency) {
          throw new AccountCurrencyMismatchError();
        }
      }
    }

    await tx.openingBalance.deleteMany({
      where:
        accountIds.length === 0
          ? { userId }
          : { userId, NOT: { accountId: { in: accountIds } } },
    });

    for (const { accountId, amount } of amounts) {
      await tx.openingBalance.upsert({
        where: { userId_accountId: { userId, accountId } },
        create: { userId, accountId, amount: BigInt(amount), month },
        update: { amount: BigInt(amount), month },
      });
    }
  });
};

// Everything the opening balance editor needs: what is saved, and a row for every active account of
// the user plus every archived one that already has an amount (so it can be corrected), in the order
// of the Banks board. The default cash account is seeded first, so there is always one row.
export const getOpeningBalanceEditorData = async (
  userId: string,
): Promise<OpeningBalanceEditorData> => {
  await ensureDefaultCash(userId);

  const [opening, rows] = await Promise.all([
    getOpeningBalances(userId),
    prisma.account.findMany({
      where: {
        userId,
        OR: [{ archivedAt: null }, { openingBalances: { some: {} } }],
      },
      include: { bank: { select: { name: true } } },
      orderBy: ACCOUNTS_IN_BOARD_ORDER,
    }),
  ]);

  return {
    opening,
    accounts: rows.map((row) => ({
      accountId: row.id,
      bankId: row.bankId,
      bankName: row.bank.name,
      accountName: row.name,
      currency: row.currency,
      archived: row.archivedAt !== null,
    })),
  };
};
