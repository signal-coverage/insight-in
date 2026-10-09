import type { AccountChoice } from "@/core/accounts/types";

export interface AccountFieldProps {
  // Every account of the user (archived ones included): the field decides which ones to offer.
  accounts: readonly AccountChoice[];
  // Only the accounts in this currency are offered: a movement is always in its account's currency.
  currency: string;
  // The id of the account chosen, or null while none is (see resolveAccountId).
  value: string | null;
  // The account the record being edited already has: offered even if it was archived since.
  keepAccountId?: string | null;
  // An account that is never offered: the other side of a transfer.
  excludeAccountId?: string | null;
  // The name the chosen id is submitted under. "accountId" when omitted (every entry form).
  name?: string;
  // What the field is called. "Cuenta" when omitted.
  label?: string;
  // Replaces "No tenés cuentas en {currency}." under the field when nothing is left to offer.
  emptyHint?: string;
  onChange: (accountId: string | null) => void;
  // What the server said about the account, shown under the field.
  errorMessage?: string;
}
