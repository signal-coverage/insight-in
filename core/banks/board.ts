import type { Bank, BankFilter, BankWithAccounts } from "./types";

// What the search compares: lower case, without accents, without surrounding spaces, so "DOLARES"
// finds "Cuenta en dólares".
export const normalizeSearch = (text: string): string =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

// The rows the board shows. Archived banks and archived accounts are hidden unless `showArchived`;
// what is hidden never takes part in the search, so a query that only matches a hidden archived
// account does not bring its bank back. A bank stays when its own name matches (with all its visible
// accounts) or when any of its visible accounts matches (with only the matching ones). The search
// compares names only. The input is never changed.
export const filterBanks = <B extends BankWithAccounts>(
  banks: readonly B[],
  { query, showArchived }: BankFilter,
): B[] => {
  const needle = normalizeSearch(query);
  const matches = (name: string): boolean =>
    needle === "" || normalizeSearch(name).includes(needle);

  return banks.flatMap((bank): B[] => {
    if (bank.archived && !showArchived) {
      return [];
    }

    const visible = bank.accounts.filter(
      (account) => showArchived || !account.archived,
    ) as B["accounts"];

    if (matches(bank.name)) {
      return [{ ...bank, accounts: visible }];
    }

    const hits = visible.filter((account) =>
      matches(account.name),
    ) as B["accounts"];

    return hits.length > 0 ? [{ ...bank, accounts: hits }] : [];
  });
};

export const countActiveAccounts = (bank: BankWithAccounts): number =>
  bank.accounts.filter((account) => !account.archived).length;

// The banks an account can be created in, with their kind (it decides the currencies on offer).
export const activeBanks = (banks: readonly BankWithAccounts[]): Bank[] =>
  banks
    .filter((bank) => !bank.archived)
    .map(({ id, name, kind, archived }) => ({ id, name, kind, archived }));
