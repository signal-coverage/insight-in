import type { ExpenseRow } from "../../types";

export interface DeleteExpenseDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  expense: ExpenseRow | null;
}

export type DeleteExpenseContentProps = Pick<
  DeleteExpenseDialogProps,
  "expense" | "onClose"
>;
