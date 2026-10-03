import type { PreviousBalance } from "@/core/balances/types";
import type { PaymentMedium } from "@/core/entries/medium";
import type { EntryStatus } from "@/core/entries/status";
import type { PendingReimbursement } from "@/core/reimbursements/types";

// What the database returns when grouping a month's entries by currency, status and medium.
export interface StatusGroup {
  currency: string;
  status: EntryStatus;
  medium: PaymentMedium;
  _sum: { amount: bigint | null };
}

// One side of the budget (incomes or expenses) in minor units: what there is in total, the part
// already collected or paid, and what is still to come. Cash and digital entries count together.
export interface SideSummary {
  total: number;
  settled: number;
  pending: number;
}

export interface CurrencySummary {
  currency: string;
  incomes: SideSummary;
  expenses: SideSummary;
  // "Saldo previo" in accounts: what was left of the earlier months (digital only).
  previous: number;
  // What is in the accounts right now: the previous balance plus the digital incomes collected,
  // minus the digital expenses paid.
  current: number;
  // Where the accounts would end the month if nothing else changed.
  target: number;
  // "Billetera": the cash held, from its previous balance and the cash that moved this month.
  wallet: number;
  // "Total disponible": what is in hand today, accounts and wallet together.
  available: number;
  // "Reintegros pendientes": what the user expects to be paid back for expenses up to the end of the
  // month and has not registered as income yet. Informational: no other figure includes it.
  pendingReimbursements: number;
}

export interface SummarizeOptions {
  // Whether incomes still to collect count towards the target remainder. On by default.
  includeExpectedIncomes?: boolean;
  // The "saldo previo" of each currency. A currency without one starts from zero.
  previous?: readonly PreviousBalance[];
  // What is still expected back per currency. Only shown: it never changes a remainder.
  reimbursements?: readonly PendingReimbursement[];
}
