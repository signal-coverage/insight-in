import type { EntryStatus } from "@/core/entries/status";

// What the database returns when grouping a month's entries by currency and status.
export interface StatusGroup {
  currency: string;
  status: EntryStatus;
  _sum: { amount: bigint | null };
}

// One side of the budget (incomes or expenses) in minor units: what there is in total, the part
// already collected or paid, and what is still to come.
export interface SideSummary {
  total: number;
  settled: number;
  pending: number;
}

export interface CurrencySummary {
  currency: string;
  incomes: SideSummary;
  expenses: SideSummary;
  // What is in hand right now: incomes collected minus expenses paid.
  current: number;
  // Where the month would end if nothing else changed.
  target: number;
}

export interface SummarizeOptions {
  // Whether incomes still to collect count towards the target remainder. On by default.
  includeExpectedIncomes?: boolean;
}
