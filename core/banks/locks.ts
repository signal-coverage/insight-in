import type { Prisma } from "@/lib/generated/prisma/client";

import type { BankKind } from "./types";

type Locker = Pick<Prisma.TransactionClient, "$queryRaw">;

export interface LockedBank {
  id: string;
  archivedAt: Date | null;
  kind: BankKind;
}

// Locks the user's bank row until the surrounding transaction ends, and reads whether it is archived and its kind.
// Every write that depends on a bank being active or on its kind (updating, archiving or deleting it,
// creating, updating or reactivating one of its accounts) takes this lock first, so two of them never interleave. The ids
// travel as parameters, never inside the SQL text. Null for a bank that is not the user's.
export const lockBank = async (
  tx: Locker,
  userId: string,
  bankId: string,
): Promise<LockedBank | null> => {
  const rows = await tx.$queryRaw<LockedBank[]>`
    SELECT "id", "archivedAt", "kind" FROM "Bank"
    WHERE "id" = ${bankId} AND "userId" = ${userId}
    FOR UPDATE
  `;

  return rows[0] ?? null;
};

// The same lock, reached from one of the user's accounts.
export const lockBankOfAccount = async (
  tx: Locker,
  userId: string,
  accountId: string,
): Promise<LockedBank | null> => {
  const rows = await tx.$queryRaw<LockedBank[]>`
    SELECT b."id", b."archivedAt", b."kind" FROM "Bank" AS b
    JOIN "Account" AS a ON a."bankId" = b."id"
    WHERE a."id" = ${accountId} AND a."userId" = ${userId} AND b."userId" = ${userId}
    FOR UPDATE OF b
  `;

  return rows[0] ?? null;
};
