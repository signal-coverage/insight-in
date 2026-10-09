import type { AccountBalance } from "@/core/balances/types";
import { formatMoney } from "@/core/incomes/money";

import type { BankWithAccounts, BoardBank } from "./types";

// The board's banks: every account with its balance (0 without movements), formatted on the server in
// the account's own currency, and whether anything points at it.
export const toBoardBanks = (
  banks: readonly BankWithAccounts[],
  balances: readonly AccountBalance[],
  withMovements: ReadonlySet<string>,
): BoardBank[] => {
  const balanceOf = new Map(
    balances.map(({ accountId, balance }) => [accountId, balance]),
  );

  return banks.map((bank) => ({
    ...bank,
    accounts: bank.accounts.map((account) => {
      const balance = balanceOf.get(account.id) ?? 0;

      return {
        ...account,
        balance,
        balanceLabel: formatMoney(balance, account.currency),
        hasMovements: withMovements.has(account.id),
      };
    }),
  }));
};
