export type OpeningBalanceActionResult =
  | { status: "success" }
  | {
      status: "error";
      message: string;
      // By path ("month", "balances.0.amount"): what the editor puts on each field.
      fieldErrors?: Record<string, string[]>;
    };

// The "saldo previo" of a month in one currency: what its accounts held when the month began.
export interface PreviousBalance {
  currency: string;
  amount: number;
}

// The stretch of days whose settled entries make up a previous balance (both ends included).
// `from` is null when it reaches back to the very first entry.
export interface PriorWindow {
  from: string | null;
  to: string;
}

// One amount held in an account at the START of the opening month, in minor units.
export interface AccountAmount {
  accountId: string;
  currency: string;
  amount: number;
}

// The opening balance kept per account: every amount shares the one month it is valid from.
export interface AccountOpening {
  month: string;
  amounts: readonly AccountAmount[];
}

// Settled money that moved in one account, one side at a time (minor units, positive for its side).
// A transfer is two flows of its own kind: out of the source and into the destination.
export interface AccountFlow {
  accountId: string;
  currency: string;
  kind: "income" | "expense" | "transferOut" | "transferIn";
  amount: number;
}

// What an account holds: its opening amount and every settled movement since.
export interface AccountBalance {
  accountId: string;
  currency: string;
  balance: number;
}

// The sum of the accounts of one currency.
export interface CurrencyBalance {
  currency: string;
  amount: number;
}

// The opening balance as the editor and the summary read it: one amount per account, one month.
export type OpeningAmount = AccountAmount;
export type OpeningBalances = AccountOpening;

// An account the opening balance editor offers a row for.
export interface OpeningAccount {
  accountId: string;
  // The bank groups the editor's rows: by id, since two banks can share a name.
  bankId: string;
  bankName: string;
  accountName: string;
  currency: string;
  archived: boolean;
}

// What the opening balance editor is built from: what is saved, and the accounts it offers.
export interface OpeningBalanceEditorData {
  opening: OpeningBalances | null;
  accounts: OpeningAccount[];
}
