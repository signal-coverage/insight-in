import type { PaymentMedium } from "@/core/entries/medium";

// What the user held in one currency and medium at the start of the opening month, in minor units.
export interface OpeningAmount {
  currency: string;
  medium: PaymentMedium;
  amount: number;
}

// The user's opening balance: every amount shares the one month from which it is valid.
export interface OpeningBalances {
  // "YYYY-MM": the amounts are the money held at the START of this month.
  month: string;
  amounts: readonly OpeningAmount[];
}

// The settled money that moved in one currency and medium, one side at a time. Only settled
// entries count: planned ones never moved any money.
export interface SettledFlow {
  currency: string;
  medium: PaymentMedium;
  kind: "income" | "expense";
  // Minor units, always positive for the side it belongs to.
  amount: number;
}

// What the opening balance editor is built from: what is saved, and the currencies it offers.
export interface OpeningBalanceEditorData {
  opening: OpeningBalances | null;
  currencies: string[];
}

export type OpeningBalanceActionResult =
  | { status: "success" }
  | {
      status: "error";
      message: string;
      // By path ("month", "balances.0.digital"): what the editor puts on each field.
      fieldErrors?: Record<string, string[]>;
    };

// The "saldo previo" of a month in one currency: what was left of the earlier months, per medium.
export interface PreviousBalance {
  currency: string;
  digital: number;
  cash: number;
}

// The stretch of days whose settled entries make up a previous balance (both ends included).
// `from` is null when it reaches back to the very first entry.
export interface PriorWindow {
  from: string | null;
  to: string;
}
