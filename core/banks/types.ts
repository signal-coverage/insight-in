import type { Account } from "@/core/accounts/types";
import type { ActionFailure } from "@/core/entries/actionHelpers";

import type { BANK_KINDS } from "./consts";

export type BankKind = (typeof BANK_KINDS)[number];

// Validated bank data.
export interface BankInput {
  name: string;
  kind: BankKind;
}

// A bank as the client reads it: no owner, and the archive date as a flag.
export interface Bank extends BankInput {
  id: string;
  archived: boolean;
}

export interface BankWithAccounts extends Bank {
  accounts: Account[];
}

// An account as the board shows it: its balance (minor units, and formatted in its currency on the
// server) and whether anything points at it (which locks its currency).
export interface BoardAccount extends Account {
  balance: number;
  balanceLabel: string;
  hasMovements: boolean;
}

export interface BoardBank extends BankWithAccounts {
  accounts: BoardAccount[];
}

// What the board shows: the text typed in the search field and whether archived items are shown.
export interface BankFilter {
  query: string;
  showArchived: boolean;
}

export type BanksFieldErrors = Record<string, string[]>;

// What every write of the banks page answers (banks and accounts alike).
export type BanksActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: BanksFieldErrors };

// A form that was read and validated, or the failure to hand back to the user.
export type ParsedForm<T> = { data: T } | { error: ActionFailure };

// A bank a new card can belong to: an active bank of the user.
export interface BankChoice {
  id: string;
  name: string;
}
