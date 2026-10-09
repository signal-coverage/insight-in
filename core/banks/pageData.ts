import { ensureDefaultCash } from "@/core/accounts/defaultCash";
import { listAccountsWithMovements } from "@/core/accounts/movements";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { prisma } from "@/infrastructure/db/client";

import { toBoardBanks } from "./boardAccounts";
import { listBanksWithAccounts } from "./service";
import type { BoardBank } from "./types";

// Everything the banks page needs: the user's banks with their accounts, each account's balance and
// whether it has movements. The first visit seeds the default cash bank (idempotent, safe when two
// requests race), so a user never lands on an empty board by accident. The three reads are
// independent, so they run together.
export const loadBanksBoard = async (userId: string): Promise<BoardBank[]> => {
  await ensureDefaultCash(userId);

  const [banks, balances, withMovements] = await Promise.all([
    listBanksWithAccounts(userId),
    readAccountBalances(prisma, userId),
    listAccountsWithMovements(prisma, userId),
  ]);

  return toBoardBanks(banks, balances, withMovements);
};
