import type { PreviousBalance } from "@/core/balances/types";
import type { EntryStatus } from "@/core/entries/status";
import type { CardWithUsage } from "@/core/cards/types";
import type {
  PendingReimbursement,
  ReimbursableExpense,
} from "@/core/reimbursements/types";

import type { AccountBalanceRow } from "./byAccount";

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
  // "Saldo previo": what the user's accounts in this currency held when the month began.
  previous: number;
  // What the accounts hold at the end of the month's movements: the previous balance plus the
  // incomes collected, minus the expenses paid (every account of the currency).
  current: number;
  // Where the accounts would end the month if nothing else changed.
  target: number;
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

// What the database returns when grouping entries by currency, day and status (the charts' read).
export interface DatedGroup {
  currency: string;
  date: Date;
  status: EntryStatus;
  _sum: { amount: bigint | null };
}

// What the database returns when grouping a month's expenses by currency and category. It must come
// from a read that EXCLUDES COVERED expenses (status in PLANNED/SETTLED, like the month totals), or the
// categories would not add up to the month's Gastos Total.
export interface CategoryGroup {
  currency: string;
  categoryId: string;
  _sum: { amount: bigint | null };
}

// Everything the charts of a month are made from, as it was read.
export interface MonthChartSources {
  incomes: readonly DatedGroup[];
  expenses: readonly DatedGroup[];
  categories: readonly CategoryGroup[];
  categoryNames: readonly { id: string; name: string }[];
}

// One month of the 6-month chart, in minor units: its incomes and its expenses "Total".
export interface MonthTotals {
  month: string;
  incomes: number;
  expenses: number;
}

export interface CurrencyMonthlySeries {
  currency: string;
  months: MonthTotals[];
}

// One bar of the category chart. `categoryId` is null for "Otras", which folds the smallest ones.
export interface CategoryAmount {
  categoryId: string | null;
  name: string;
  amount: number;
}

export interface CurrencyCategories {
  currency: string;
  // What every bar adds up to: the month's expenses "Total" in this currency.
  total: number;
  categories: CategoryAmount[];
}

// What the accounts of a currency held at the end of a day, in minor units.
export interface DailyBalancePoint {
  date: string;
  balance: number;
}

export interface CurrencyDailyBalance {
  currency: string;
  points: DailyBalancePoint[];
}

// The three charts of a month, one list per chart, each one per currency (never mixed).
export interface MonthCharts {
  monthly: CurrencyMonthlySeries[];
  categories: CurrencyCategories[];
  daily: CurrencyDailyBalance[];
}

// A planned income or expense as the attention block reads it.
export interface PlannedEntry {
  id: string;
  description: string;
  currency: string;
  // Minor units.
  amount: number;
  // "YYYY-MM-DD": the date the app shows (for a card charge, the day the statement is paid).
  date: string;
}

export type AttentionKind =
  | "overdueExpense"
  | "negativeAccount"
  | "cardLimit"
  | "upcomingExpense"
  | "overdueIncome"
  | "reimbursement";

// Whether the item's amount is shown in the danger colour (overdue, negative, over the cap).
export type AttentionSeverity = "danger" | "warning";

export interface AttentionItem {
  kind: AttentionKind;
  id: string;
  // What it is: the entry's description, "Banco · Cuenta", or "Visa •••• 1234 · Banco".
  title: string;
  currency: string;
  // Minor units of `currency`: the entry's amount, what is outstanding, the balance, or what the card used.
  amount: number;
  // The cap, for a card; null otherwise.
  limit: number | null;
  // "YYYY-MM-DD" for entries and reimbursements; null for accounts and cards.
  date: string | null;
  severity: AttentionSeverity;
}

export interface AttentionGroup {
  kind: AttentionKind;
  // The most urgent ones, at most ATTENTION_ITEMS_PER_GROUP.
  items: AttentionItem[];
  // How many more there are beyond `items`.
  hiddenCount: number;
}

// What the attention read brings from the database (the accounts come from the "Por cuenta" read).
export interface AttentionReads {
  plannedExpenses: PlannedEntry[];
  plannedIncomes: PlannedEntry[];
  reimbursements: ReimbursableExpense[];
  cards: CardWithUsage[];
}

export interface AttentionSources extends AttentionReads {
  // "YYYY-MM-DD", the Argentine calendar date.
  today: string;
  accounts: readonly AccountBalanceRow[];
}
