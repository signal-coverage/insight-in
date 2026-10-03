import { AlertDialog } from "@heroui/react";

import { DeleteCardContent } from "./DeleteCardContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteCardDialogProps } from "./types";

export function DeleteCardDialog({
  isOpen,
  onOpenChange,
  onClose,
  onDeleting,
  card,
}: DeleteCardDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteCardContent
            key={card?.id}
            card={card}
            onClose={onClose}
            onDeleting={onDeleting}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
