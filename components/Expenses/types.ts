import type {
  CategoryWithCount,
  InstallmentPlanRow,
  OriginStrings,
  PaginationInfo,
  TotalRow,
} from "@/components/Entries/types";
import type { Source } from "@/components/shared/Await";
import type { AccountChoice } from "@/core/accounts/types";
import type { CardWithCharges } from "@/core/cards/types";
import type { EntriesQuery } from "@/core/entries/query";
import type { Expense, RecurringExpenseItem } from "@/core/expenses/types";
import type { PlanProgress } from "@/core/installments/types";

// A card the forms can pay with: the card with its charges (the planner projects a purchase against
// them), its title ("Visa •••• 1234") and the currencies it can pay in.
export type CardOption = CardWithCharges & {
  title: string;
  currencies: string[];
};

export type CreditCardOption = Extract<CardOption, { kind: "CREDIT" }>;

export type DebitCardOption = Extract<CardOption, { kind: "DEBIT" }>;

// An expense plus the strings the UI needs, formatted on the server so the client never has to
// re-derive money or date presentation.
export interface ExpenseRow extends Expense, OriginStrings {
  amountLabel: string;
  amountDecimal: string;
  dateLabel: string;
  // What the expense expects to be paid back as a plain decimal ("4000.00"), to prefill the form; null
  // when it expects nothing.
  expectedReimbursementDecimal: string | null;
  // What the marker's tooltip says ("Te deben $ 4.000,00 de $ 10.000,00" or "Reintegro completo"); null
  // when the expense expects nothing.
  reimbursementTooltip: string | null;
  // For an installment: how many entries its plan has and how many are already paid. Absent otherwise.
  planProgress?: PlanProgress;
}

// A recurring template plus the strings the wizard shows, formatted on the server like the rows.
export interface RecurringRow extends RecurringExpenseItem {
  amountLabel: string;
  // The template amount as plain text ("350000.50"), to prefill the input for this month.
  amountDecimal: string;
  // "Día 5".
  dayLabel: string;
  // The reference price of the template as a plain decimal ("20.00"), to prefill the template form.
  originAmountDecimal: string | null;
  // "Referencia: US$ 20,00" under the amount, or null when the template has no reference price.
  referenceLabel: string | null;
}

// A purchase paid in installments plus the strings the wizard shows (shared with the loans repaid in
// installments of the incomes page).
export type { InstallmentPlanRow };

// The templates for the month being resolved: the ones still waiting for a choice and the ones
// already decided, and how many are waiting; plus the purchases in installments with something
// left to pay, which never count as waiting.
export interface RecurringData {
  month: string;
  // "Octubre de 2026".
  monthLabel: string;
  pending: RecurringRow[];
  decided: RecurringRow[];
  pendingCount: number;
  plans: InstallmentPlanRow[];
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
  // The user's cards, for the card choice of the expense form and the installment planner.
  cards: Source<CardOption[]>;
  // Every account of the user, for the "Cuenta" field of the forms.
  accounts: Source<AccountChoice[]>;
}

// What the installment planner opens with: the key remounts it on every opening, and the date is
// where the first installment's date starts (today, Argentine time).
export interface PlannerTarget {
  key: number;
  defaultDate: string;
}

// What the form drawer is currently showing. The key remounts the form so every opening starts
// from fresh defaults and cleared errors.
export interface FormTarget {
  key: number;
  expense: ExpenseRow | null;
  defaultDate: string;
}
