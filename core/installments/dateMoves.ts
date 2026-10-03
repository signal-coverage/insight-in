import type { Prisma } from "@/lib/generated/prisma/client";

import type { DateMove } from "./types";

// Writes the date changes of a reflow in ONE statement, however many installments move. The database
// is remote, so every statement costs a round trip: one `update` per installment made a 12-installment
// plan take seconds. The ids and the dates travel as two parallel array parameters (never glued into
// the SQL text) and are zipped by `unnest`, so the statement has a fixed shape. `updatedAt` is set by
// hand because the client only does it for its own updates.
type Executor = Pick<Prisma.TransactionClient, "$executeRaw">;

const splitMoves = (moves: readonly DateMove[]) => ({
  ids: moves.map(({ id }) => id),
  dates: moves.map(({ date }) => date),
});

// Nothing but the date of an installment changes, only on planned incomes of the user: one collected
// meanwhile never moves, and ids that are not the user's match nothing. Returns the rows updated.
export const moveIncomeDates = async (
  db: Executor,
  userId: string,
  moves: readonly DateMove[],
): Promise<number> => {
  if (moves.length === 0) {
    return 0;
  }

  const { ids, dates } = splitMoves(moves);

  return db.$executeRaw`
    UPDATE "Income" AS t
    SET "date" = v."date", "updatedAt" = NOW()
    FROM unnest(${ids}::text[], ${dates}::date[]) AS v("id", "date")
    WHERE t."id" = v."id"
      AND t."userId" = ${userId}
      AND t."status" = 'PLANNED'
  `;
};

// The same for the installments of a purchase: only the date, only the user's rows. (The reflow
// itself only ever picks pending installments, so, as before, no status is checked here.)
export const moveExpenseDates = async (
  db: Executor,
  userId: string,
  moves: readonly DateMove[],
): Promise<number> => {
  if (moves.length === 0) {
    return 0;
  }

  const { ids, dates } = splitMoves(moves);

  return db.$executeRaw`
    UPDATE "Expense" AS t
    SET "date" = v."date", "updatedAt" = NOW()
    FROM unnest(${ids}::text[], ${dates}::date[]) AS v("id", "date")
    WHERE t."id" = v."id"
      AND t."userId" = ${userId}
  `;
};
