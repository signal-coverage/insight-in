import type { EntryCategory } from "@/components/Entries/types";
import type { RecurringChoice } from "@/core/expenses/types";

import type { RecurringData } from "../../types";

export interface RecurringExpensesDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Remounts the wizard on every opening, so each one starts with no choice made.
  sessionKey: number;
  data: RecurringData;
  // For the form that edits a template.
  categories: readonly EntryCategory[];
}

export type RecurringExpensesContentProps = Pick<
  RecurringExpensesDrawerProps,
  "onClose" | "data" | "categories"
>;

// What the user picked per template id; a template without an entry has no choice yet.
export type Choices = Record<string, RecurringChoice>;

// What the user typed in the amount input per template id; once applied, it becomes the template's.
export type Amounts = Record<string, string>;

// Why the last thing done to a row did not work, per template id (the row has no entry otherwise).
export type RowErrors = Record<string, string>;
