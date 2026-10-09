// Validated transfer data. `amount` is in minor units of `currency`; `date` is "YYYY-MM-DD".
export interface TransferInput {
  currency: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  notes: string | null;
}

// A transfer as the client reads it: no owner, the accounts labelled "Banco · Cuenta", and the
// currency of its accounts.
export interface Transfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  fromLabel: string;
  toLabel: string;
  currency: string;
  amount: number;
  date: string;
  notes: string | null;
}

export type TransferFieldErrors = Record<string, string[]>;

export type TransferActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: TransferFieldErrors };

// What deleting several transfers at once answers: how many went away.
export type TransfersDeleteResult =
  { status: "success"; deleted: number } | { status: "error"; message: string };
