import type { RecurringChoice } from "@/core/expenses/types";

import type { RecurringData } from "../../types";

export interface RecurringExpensesDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Remounts the wizard on every opening, so each one starts with no choice made.
  sessionKey: number;
  data: RecurringData;
}

export type RecurringExpensesContentProps = Pick<
  RecurringExpensesDrawerProps,
  "onClose" | "data"
>;

// What the user picked per template id; a template without an entry has no choice yet.
export type Choices = Record<string, RecurringChoice>;

// What the user typed in the amount input per template id, for this month only.
export type Amounts = Record<string, string>;
