import type { RecurringRow } from "../../types";

export interface RecurringIncomesDrawerProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  recurring: readonly RecurringRow[];
  onAdd: () => void;
  onEdit: (recurring: RecurringRow) => void;
}

export type RecurringIncomesContentProps = Pick<
  RecurringIncomesDrawerProps,
  "onClose" | "recurring" | "onAdd" | "onEdit"
>;
