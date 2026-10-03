import type { PaymentMedium } from "@/core/entries/medium";
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
  // Whether the money left an account or came out of the wallet.
  medium: PaymentMedium;
  // The form's switch. On save it creates a template when the expense is not linked to one yet.
  isRecurring: boolean;
  // The card the purchase was paid with, or null. With a card `date` is the purchase day on the way
  // in (the server turns it into the charge date), and the charge date on the way out.
  cardId: string | null;
  // The price the expense was quoted in, kept as a reference (never part of any total, which only
  // count `amount`, what really left the user's money): a crypto asset or another currency, and the
  // amount in its minor units. Both are set or both are null.
  originCurrency: string | null;
  originAmount: number | null;
  // What the user expects to be paid back for this expense (minor units, in its currency), or null
  // when nothing is expected. Other incomes can then be linked to it as the repayment.
  expectedReimbursement: number | null;
}

export interface Expense extends ExpenseInput {
  // What the incomes linked to this expense add up to, whatever their status (minor units).
  reimbursementReceived: number;
  id: string;
  categoryName: string;
  // The day a purchase paid with a card was made: `date` is then the day the card statement is paid.
  // Null for an expense without a card and for the installments of a plan.
  purchaseDate: string | null;
  // Set for an installment of a plan ("compra en cuotas"), with its fixed number 1..N.
  installmentPlanId: string | null;
  installmentNumber: number | null;
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
  // Copied onto the expense the wizard creates from it.
  medium: PaymentMedium;
  // The reference price the template remembers (20 USD for a subscription that costs 35.000 ARS),
  // copied onto the expense the wizard creates: a currency and its amount in minor units, both set
  // or both null.
  originCurrency: string | null;
  originAmount: number | null;
  dayOfMonth: number;
  decision: RecurringDecisionValue | null;
}

// Validated data of a template edited on its own. `amount` is in minor units.
export interface RecurringExpenseInput {
  description: string;
  amount: number;
  currency: string;
  categoryId: string;
  notes: string | null;
  medium: PaymentMedium;
  // The reference price (see RecurringExpenseItem); both set or both null.
  originCurrency: string | null;
  originAmount: number | null;
  // 1..31; a shorter month uses its last day.
  dayOfMonth: number;
}

// One row of what the wizard sends. The amount counts when enabling or disabling (it is kept on
// the template) and means nothing when removing, since the template goes away.
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
  // The templates whose amount changed (minor units), for the months to come. Only for templates
  // that are enabled or disabled, and only when the amount really differs from the stored one.
  amountUpdates: { templateId: string; amount: number }[];
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
