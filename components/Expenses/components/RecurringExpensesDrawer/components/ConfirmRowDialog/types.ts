import type { ExpenseActionResult } from "@/core/expenses/types";

import type { RecurringRow } from "../../../../types";

// What the dialog says for one kind of confirmation.
export interface ConfirmRowCopy {
  heading: string;
  // The question, naming the expense.
  body: (description: string) => string;
  confirmLabel: string;
  pendingLabel: string;
}

export interface ConfirmRowDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // The template the question is about; kept after the dialog closes so it never flashes empty.
  row: RecurringRow | null;
  copy: ConfirmRowCopy;
  // What confirming does, given the template's id.
  onConfirm: (id: string) => Promise<ExpenseActionResult>;
  // The server refused: the dialog closes and the reason goes under the row.
  onFailure: (id: string, message: string) => void;
}
