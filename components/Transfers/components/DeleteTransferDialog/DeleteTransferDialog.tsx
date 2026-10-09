import { AlertDialog } from "@heroui/react";

import { DeleteTransferContent } from "./DeleteTransferContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteTransferDialogProps } from "./types";

export function DeleteTransferDialog({
  isOpen,
  onOpenChange,
  onClose,
  onDeleting,
  transfer,
}: DeleteTransferDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteTransferContent
            key={transfer?.id}
            transfer={transfer}
            onClose={onClose}
            onDeleting={onDeleting}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
