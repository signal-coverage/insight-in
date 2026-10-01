import type {
  CategoryWithCount,
  PaginationInfo,
  TotalRow,
} from "@/components/Entries/types";
import type { Source } from "@/components/shared/Await";
import type { EntriesQuery } from "@/core/entries/query";
import type { Expense, RecurringExpenseItem } from "@/core/expenses/types";

// An expense plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or date presentation.
export interface ExpenseRow extends Expense {
  amountLabel: string;
  amountDecimal: string;
  dateLabel: string;
}

// A recurring template plus the strings the wizard shows, formatted on the server like the rows.
export interface RecurringRow extends RecurringExpenseItem {
  amountLabel: string;
  // The template amount as plain text ("350000.50"), to prefill the input for this month.
  amountDecimal: string;
  // "Día 5".
  dayLabel: string;
}

// The templates for the month being resolved: the ones still waiting for a choice and the ones
// already decided, and how many are waiting.
export interface RecurringData {
  month: string;
  // "Octubre de 2026".
  monthLabel: string;
  pending: RecurringRow[];
  decided: RecurringRow[];
  pendingCount: number;
}

// What the table needs, which all arrives together: the page of rows, the paging the server
// actually applied, and whether the user has any expense at all (an empty page then means
// "nothing matches" and not "nothing yet").
export interface ExpensesTableData {
  rows: ExpenseRow[];
  pagination: PaginationInfo;
  hasAnyExpenses: boolean;
}

// Every piece of data is a `Source`: the value itself, or a promise of it while it loads. The page
// renders its structure at once and each section waits only for its own piece.
export interface ExpensesProps {
  // The Argentine calendar date, which defines the default date range.
  today: string;
  // The list state parsed from the URL: known without waiting for any data.
  query: EntriesQuery;
  totals: Source<readonly TotalRow[]>;
  categories: Source<CategoryWithCount[]>;
  // Currencies the user has expenses in, for the currency filter.
  currencies: Source<string[]>;
  table: Source<ExpensesTableData>;
  // The recurring templates of the current month, for the notice and the wizard.
  recurring: Source<RecurringData>;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts
// from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  expense: ExpenseRow | null;
  defaultDate: string;
}
