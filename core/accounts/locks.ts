import type { Prisma } from "@/lib/generated/prisma/client";

type Locker = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface LockedAccount {
  id: string;
  currency: string;
  archivedAt: Date | null;
}

// Locks the user's account row (FOR NO KEY UPDATE) until the surrounding transaction ends. Archiving
// the account and changing its currency take it, so the checks they make (its balance, its movements) stay true until
// they write. FOR NO KEY UPDATE rather than FOR UPDATE: inserting a row that references the account
// takes FOR KEY SHARE on it, which conflicts with FOR UPDATE but not with this lock, so a transfer
// holding two accounts no longer deadlocks with a multi-account insert; it still conflicts with itself,
// with FOR SHARE and with FOR UPDATE. The ids travel as parameters. Null for an account that is not the user's.
export const lockAccount = async (
  tx: Locker,
  userId: string,
  accountId: string,
): Promise<LockedAccount | null> => {
  const rows = await tx.$queryRaw<LockedAccount[]>`
    SELECT "id", "currency", "archivedAt" FROM "Account"
    WHERE "id" = ${accountId} AND "userId" = ${userId}
    FOR NO KEY UPDATE
  `;

  return rows[0] ?? null;
};

// The one order in which several account rows are ever locked: ascending id, each once. Every writer
// that locks more than one account (a transfer, the opening balance save) uses it, so two of them can
// never wait for each other's rows.
export const inLockOrder = (ids: readonly string[]): string[] =>
  [...new Set(ids)].sort();

// Locks the user's accounts one after the other, in lock order, until the surrounding transaction ends.
// The map holds the ones that are the user's (an id that is not simply is not in it).
export const lockAccounts = async (
  tx: Locker,
  userId: string,
  accountIds: readonly string[],
): Promise<Map<string, LockedAccount>> => {
  const locked = new Map<string, LockedAccount>();

  for (const id of inLockOrder(accountIds)) {
    const account = await lockAccount(tx, userId, id);

    if (account) {
      locked.set(id, account);
    }
  }

  return locked;
};

// A shared lock on the user's accounts until the surrounding transaction ends, in lock order. It lets
// other readers in but makes a writer that needs the exclusive lock (archiving the account, changing
// its currency, moving money through a transfer) wait for this transaction, and the other way round:
// what the transaction read about the accounts stays true until it commits. Ids and userId travel as
// parameters. An id that is not the user's simply locks nothing.
export const lockAccountsShared = async (
  tx: Locker,
  userId: string,
  accountIds: readonly string[],
): Promise<void> => {
  for (const id of inLockOrder(accountIds)) {
    await tx.$queryRaw`
      SELECT "id" FROM "Account"
      WHERE "id" = ${id} AND "userId" = ${userId}
      FOR SHARE
    `;
  }
};
