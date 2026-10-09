import { AlertDialog } from "@heroui/react";

import { ConfirmDeleteContent } from "./ConfirmDeleteContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { ConfirmDeleteDialogProps } from "./types";

// The "are you sure" step before deleting a bank or an account for good. Each caller brings its own
// wording and its own server action.
export function ConfirmDeleteDialog({
  isOpen,
  onOpenChange,
  ...contentProps
}: ConfirmDeleteDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <ConfirmDeleteContent {...contentProps} />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
