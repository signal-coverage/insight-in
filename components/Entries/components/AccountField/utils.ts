import type { AccountChoice } from "@/core/accounts/types";

// The accounts a movement in `currency` can go to: the active ones, plus the one the record already has
// (`keepAccountId`) even if it was archived since, minus the one that is excluded (the other side of a
// transfer). The order is the one given (the board's).
export const offeredAccounts = (
  accounts: readonly AccountChoice[],
  currency: string,
  keepAccountId: string | null = null,
  excludeAccountId: string | null = null,
): AccountChoice[] =>
  accounts.filter(
    (account) =>
      account.currency === currency &&
      account.id !== excludeAccountId &&
      (!account.archived || account.id === keepAccountId),
  );

// The account the field shows: the choice while it is still offered (a currency change drops one of
// the old currency); otherwise the only account of the currency, so the common case needs no click;
// otherwise none.
export const resolveAccountId = (
  accounts: readonly AccountChoice[],
  currency: string,
  chosen: string | null,
  keepAccountId: string | null = null,
  excludeAccountId: string | null = null,
): string | null => {
  const offered = offeredAccounts(
    accounts,
    currency,
    keepAccountId,
    excludeAccountId,
  );

  if (chosen !== null && offered.some((account) => account.id === chosen)) {
    return chosen;
  }

  return offered.length === 1 ? offered[0].id : null;
};
