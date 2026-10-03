import type { PaymentMedium } from "@/core/entries/medium";
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
  // Whether the money arrived in an account or as cash.
  medium: PaymentMedium;
  // What the net amount came from, kept as a reference (never part of any total): a crypto asset or
  // another currency, and the amount in its minor units. Both are set or both are null.
  originCurrency: string | null;
  originAmount: number | null;
  // The expense this income pays back (or part of it), or null. It is the user's, in the same
  // currency and expects a reimbursement.
  reimbursesExpenseId: string | null;
}

export interface Income extends IncomeInput {
  // The description of the expense this income pays back, for the table.
  reimbursesExpenseDescription: string | null;
  id: string;
  categoryName: string;
  // Set when the income was generated from a recurring template.
  recurringIncomeId: string | null;
  // Set for an installment of a loan repaid in cuotas, with its fixed number 1..N.
  installmentPlanId: string | null;
  installmentNumber: number | null;
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
  // Copied onto every income the template generates.
  medium: PaymentMedium;
  frequency: "WEEKLY" | "MONTHLY" | "YEARLY";
  startDate: string;
  endDate: string | null;
}

export interface RecurringIncome extends RecurringIncomeInput {
  id: string;
  categoryName: string;
}
