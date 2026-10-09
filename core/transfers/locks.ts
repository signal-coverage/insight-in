import type { Prisma } from "@/lib/generated/prisma/client";

type Locker = Pick<Prisma.TransactionClient, "$queryRaw">;

// Locks the user's transfer rows (ascending id, one statement) until the surrounding transaction ends.
// An edit or a delete takes them BEFORE reading the transfer, so a concurrent edit of the same transfer
// has committed (or waits) by the time the accounts the transfer really has are read and locked. The
// ids and the owner travel as parameters. An id that is gone or is not the user's is simply not
// locked; the caller finds no row for it when it reads.
export const lockTransfers = async (
  tx: Locker,
  userId: string,
  transferIds: readonly string[],
): Promise<void> => {
  if (transferIds.length === 0) {
    return;
  }

  const ids = [...new Set(transferIds)];

  await tx.$queryRaw`
    SELECT "id" FROM "Transfer"
    WHERE "id" = ANY(${ids}) AND "userId" = ${userId}
    ORDER BY "id"
    FOR UPDATE
  `;
};
