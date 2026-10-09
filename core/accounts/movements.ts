import type { Prisma } from "@/lib/generated/prisma/client";

export type MovementReader = Pick<Prisma.TransactionClient, "account">;

// Everything that points at an account and pins its currency: its incomes and expenses, its recurring
// templates and installment plans, its opening amount and the transfers that leave it or enter it.
const MOVEMENT_COUNTS = {
  incomes: true,
  expenses: true,
  recurringIncomes: true,
  recurringExpenses: true,
  installmentPlans: true,
  openingBalances: true,
  transfersOut: true,
  transfersIn: true,
} as const;

const totalOf = (
  counts: Record<keyof typeof MOVEMENT_COUNTS, number>,
): number => Object.values(counts).reduce((sum, count) => sum + count, 0);

// How many things point at the user's account (0 for an account that is not the user's).
export const countAccountMovements = async (
  db: MovementReader,
  userId: string,
  accountId: string,
): Promise<number> => {
  const row = await db.account.findFirst({
    where: { id: accountId, userId },
    select: { _count: { select: MOVEMENT_COUNTS } },
  });

  return row ? totalOf(row._count) : 0;
};

// The ids of the user's accounts that anything points at, in one query.
export const listAccountsWithMovements = async (
  db: MovementReader,
  userId: string,
): Promise<Set<string>> => {
  const rows = await db.account.findMany({
    where: { userId },
    select: { id: true, _count: { select: MOVEMENT_COUNTS } },
  });

  return new Set(
    rows.filter((row) => totalOf(row._count) > 0).map((row) => row.id),
  );
};
