import { ACCOUNTS_IN_BOARD_ORDER } from "@/core/accounts/order";
import { readAccountBalances } from "@/core/balances/accountBalances";
import { prisma } from "@/infrastructure/db/client";

// One account with what it holds now, for the "Por cuenta" card.
export interface AccountBalanceRow {
  accountId: string;
  accountName: string;
  bankId: string;
  bankName: string;
  currency: string;
  // Minor units of `currency`; negative when the account owes.
  balance: number;
  archived: boolean;
}

// Every account of the user, in the order of the Banks board (bank, then account, by creation), with
// its balance as it is now: every settled movement, incomes, expenses and transfers alike, through the
// same reader the Banks board and the archive rule use, so the three always agree. An account without
// movements holds 0. Scoped by userId; the two reads are independent, so they run together.
export const listAccountBalanceRows = async (
  userId: string,
): Promise<AccountBalanceRow[]> => {
  const [accounts, balances] = await Promise.all([
    prisma.account.findMany({
      where: { userId },
      include: { bank: { select: { name: true } } },
      orderBy: ACCOUNTS_IN_BOARD_ORDER,
    }),
    readAccountBalances(prisma, userId),
  ]);
  const balanceOf = new Map(
    balances.map(({ accountId, balance }) => [accountId, balance]),
  );

  return accounts.map((account) => ({
    accountId: account.id,
    accountName: account.name,
    bankId: account.bankId,
    bankName: account.bank.name,
    currency: account.currency,
    balance: balanceOf.get(account.id) ?? 0,
    archived: account.archivedAt !== null,
  }));
};
