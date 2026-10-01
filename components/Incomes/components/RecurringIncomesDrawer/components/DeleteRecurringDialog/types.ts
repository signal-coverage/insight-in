import type { RecurringRow } from "../../../../types";

export interface DeleteRecurringDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  recurring: RecurringRow | null;
  onConfirm: () => Promise<void>;
}
