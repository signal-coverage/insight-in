import type { Source } from "@/components/shared/Await";
import type { EntriesQuery } from "@/core/entries/query";
import type {
  CategoryWithCount,
  PaginationInfo,
  TotalRow,
} from "@/components/Entries/types";
import type { Income, RecurringIncome } from "@/core/incomes/types";

export type { PaginationInfo, TotalRow };

// An income plus the strings the UI needs, formatted on the server so the client never
// has to re-derive money or date presentation.
export interface IncomeRow extends Income {
  amountLabel: string;
  amountDecimal: string;
  dateLabel: string;
}

// What the table needs, which all arrives together: the page of rows, the paging the server
// actually applied, and whether the user has any income at all (an empty page then means "nothing
// matches" and not "nothing yet").
export interface IncomesTableData {
  rows: IncomeRow[];
  pagination: PaginationInfo;
  hasAnyIncomes: boolean;
}

// Every piece of data is a `Source`: the value itself, or a promise of it while it loads. The page
// renders its structure at once and each section waits only for its own piece, so nothing but the
// table, the totals and the two selects ever shows a loading state.
export interface IncomesProps {
  // The user's calendar date (from their time zone), which defines the default date range.
  today: string;
  // The list state parsed from the URL: known without waiting for any data.
  query: EntriesQuery;
  totals: Source<readonly TotalRow[]>;
  categories: Source<CategoryWithCount[]>;
  // Currencies the user has incomes in, for the currency filter.
  currencies: Source<string[]>;
  table: Source<IncomesTableData>;
  recurring: Source<RecurringRow[]>;
}

// What the form modal is currently showing. The key remounts the form so every opening
// starts from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  income: IncomeRow | null;
  defaultDate: string;
}

// A recurring template plus the strings the UI needs, formatted on the server.
export interface RecurringRow extends RecurringIncome {
  amountLabel: string;
  amountDecimal: string;
  frequencyLabel: string;
  // "Próximo: 5 oct 2026" or "Serie finalizada".
  nextLabel: string;
  // "Termina el 1 jun 2026", or null for a series without an end.
  endLabel: string | null;
}

// What the recurring form drawer is showing; the key remounts it on every opening.
export interface RecurringFormTarget {
  key: number;
  recurring: RecurringRow | null;
  defaultDate: string;
}
