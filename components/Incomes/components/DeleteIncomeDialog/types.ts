import type { IncomeRow } from "../../types";

export interface DeleteIncomeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  income: IncomeRow | null;
}

export type DeleteIncomeContentProps = Pick<
  DeleteIncomeDialogProps,
  "income" | "onClose"
>;
