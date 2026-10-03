import { AlertDialog } from "@heroui/react";

import { DeleteItemContent } from "./DeleteItemContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteItemDialogProps } from "./types";

export function DeleteItemDialog({
  isOpen,
  onOpenChange,
  onClose,
  item,
}: DeleteItemDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <DeleteItemContent key={item?.id} item={item} onClose={onClose} />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
