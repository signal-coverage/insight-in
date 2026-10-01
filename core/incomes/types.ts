import type { EntryStatus } from "@/core/entries/status";

export type { CurrencyTotal } from "@/core/entries/types";

// Validated income data. `amount` is expressed in minor units (e.g. cents) and `date`
// is a calendar date in YYYY-MM-DD form.
export interface IncomeInput {
  description: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string;
  notes: string | null;
  status: EntryStatus;
}

export interface Income extends IncomeInput {
  id: string;
  categoryName: string;
  // Set when the income was generated from a recurring template.
  recurringIncomeId: string | null;
}

export interface IncomeCategory {
  id: string;
  name: string;
}

export type IncomeFieldErrors = Record<string, string[]>;

export type IncomeActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: IncomeFieldErrors };

export type CategoryActionResult =
  | { status: "success"; category: IncomeCategory }
  | { status: "error"; message: string; fieldErrors?: IncomeFieldErrors };

export interface IncomeCategoryWithCount extends IncomeCategory {
  incomeCount: number;
}

export interface IncomesPage {
  rows: Income[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// A template that generates an income on every occurrence of its schedule.
export interface RecurringIncomeInput {
  description: string;
  amount: number;
  currency: string;
  categoryId: string;
  notes: string | null;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  startDate: string;
  endDate: string | null;
}

export interface RecurringIncome extends RecurringIncomeInput {
  id: string;
  categoryName: string;
}
