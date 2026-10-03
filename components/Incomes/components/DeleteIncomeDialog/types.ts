import type { IncomeRow } from "../../types";

export interface DeleteIncomeDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onClose: () => void;
  // Called with the id about to go, once the delete is confirmed and before it is awaited.
  onDeleting: (ids: readonly string[]) => void;
  // Called with the plan about to go, once deleting the whole plan is confirmed and before it is
  // awaited: every row of the plan reads as on its way out.
  onDeletingPlan: (planId: string) => void;
  income: IncomeRow | null;
}

export type DeleteIncomeContentProps = Pick<
  DeleteIncomeDialogProps,
  "income" | "onClose" | "onDeleting" | "onDeletingPlan"
>;
