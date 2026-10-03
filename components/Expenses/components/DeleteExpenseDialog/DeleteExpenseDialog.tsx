import { AlertDialog } from "@heroui/react";

import { DeleteExpenseContent } from "./DeleteExpenseContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteExpenseDialogProps } from "./types";

export function DeleteExpenseDialog({
  isOpen,
  onOpenChange,
  onClose,
  onDeleting,
  onDeletingPlan,
  expense,
}: DeleteExpenseDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteExpenseContent
            key={expense?.id}
            expense={expense}
            onClose={onClose}
            onDeleting={onDeleting}
            onDeletingPlan={onDeletingPlan}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
