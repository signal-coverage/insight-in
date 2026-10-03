import { AlertDialog } from "@heroui/react";

import { BulkDeleteContent } from "./BulkDeleteContent";
import { DIALOG_CLASS_NAME } from "./styles";
import type { BulkDeleteDialogProps } from "./types";

// The confirmation of deleting several rows at once. The same dialog serves every table; each page
// brings its own wording and its own action.
export function BulkDeleteDialog({
  isOpen,
  onOpenChange,
  ...contentProps
}: BulkDeleteDialogProps) {
  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <BulkDeleteContent
            key={contentProps.ids.join(",")}
            {...contentProps}
          />
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
