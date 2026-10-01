import { AlertDialog } from "@heroui/react";

import { DIALOG_CLASS_NAME } from "./styles";
import { DeleteIncomeContent } from "./DeleteIncomeContent";
import type { DeleteIncomeDialogProps } from "./types";

export function DeleteIncomeDialog({
  isOpen,
  onOpenChange,
  onClose,
  income,
}: DeleteIncomeDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteIncomeContent
            key={income?.id}
            income={income}
            onClose={onClose}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
