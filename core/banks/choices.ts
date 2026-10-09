import { prisma } from "@/infrastructure/db/client";

import type { BankChoice } from "./types";

// The user's active banks, in the order of the Banks board: the ones a new card can belong to (an
// archived bank takes no new card). Scoped by userId.
export const listBankChoices = async (userId: string): Promise<BankChoice[]> =>
  prisma.bank.findMany({
    where: { userId, archivedAt: null },
    select: { id: true, name: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
