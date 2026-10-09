import type { CurrencyAccountsRow } from "../../types";

export interface AccountsSectionProps {
  // One row per currency that has accounts to show. Nothing renders without any.
  rows: readonly CurrencyAccountsRow[];
}
