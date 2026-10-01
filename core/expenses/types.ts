import type { EntryStatus } from "@/core/entries/status";

import type { RECURRING_CHOICES } from "./consts";

export type { CurrencyTotal } from "@/core/entries/types";

// Validated expense data. `amount` is expressed in minor units (e.g. cents) and `date` is a
// calendar date in YYYY-MM-DD form.
export interface ExpenseInput {
  description: string;
  amount: number;
  currency: string;
  date: string;
  categoryId: string;
  notes: string | null;
  status: EntryStatus;
  // The form's switch. On save it creates a template when the expense is not linked to one yet.
  isRecurring: boolean;
}

export interface Expense extends ExpenseInput {
  id: string;
  categoryName: string;
}

export type RecurringChoice = (typeof RECURRING_CHOICES)[number];

// What was decided about a template for one month (the database enum has the same values).
export type RecurringDecisionValue = "ENABLED" | "DISABLED";

// A template plus what the user decided for the month being resolved (null: still waiting).
export interface RecurringExpenseItem {
  id: string;
  description: string;
  // Minor units, like Expense.amount.
  amount: number;
  currency: string;
  categoryId: string;
  categoryName: string;
  notes: string | null;
  dayOfMonth: number;
  decision: RecurringDecisionValue | null;
}

// One row of what the wizard sends. The amount only counts when enabling.
export interface RecurringDecisionInput {
  recurringExpenseId: string;
  choice: RecurringChoice;
  amount?: string;
}

// What applying the decisions will write.
export interface RecurringPlan {
  enable: { templateId: string; date: string; amount: number }[];
  disable: string[];
  remove: string[];
}

export interface ExpenseCategory {
  id: string;
  name: string;
}

export interface ExpenseCategoryWithCount extends ExpenseCategory {
  expenseCount: number;
}

export type ExpenseFieldErrors = Record<string, string[]>;

export type ExpenseActionResult =
  | { status: "success" }
  | { status: "error"; message: string; fieldErrors?: ExpenseFieldErrors };

export type ExpenseCategoryActionResult =
  | { status: "success"; category: ExpenseCategory }
  | { status: "error"; message: string; fieldErrors?: ExpenseFieldErrors };

export interface ExpensesPage {
  rows: Expense[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
