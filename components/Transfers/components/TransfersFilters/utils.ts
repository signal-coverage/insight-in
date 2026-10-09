import type { FilterOption } from "@/components/Entries/components/EntriesFilters/types";
import type { AccountChoice } from "@/core/accounts/types";

// Every account, archived ones included: a past transfer may have used one.
export const accountOptions = (
  accounts: readonly AccountChoice[],
): FilterOption[] => accounts.map(({ id, label }) => ({ id, label }));

// The currencies the user's accounts hold, each once.
export const currencyCodes = (accounts: readonly AccountChoice[]): string[] => [
  ...new Set(accounts.map(({ currency }) => currency)),
];
