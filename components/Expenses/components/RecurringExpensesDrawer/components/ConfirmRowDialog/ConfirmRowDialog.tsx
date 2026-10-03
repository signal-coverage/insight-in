import { AlertDialog, Button } from "@heroui/react";
import { useTransition } from "react";

import { PendingButton } from "@/components/shared/PendingButton";

import { CANCEL_LABEL } from "./consts";
import { DIALOG_CLASS_NAME } from "./styles";
import type { ConfirmRowDialogProps } from "./types";

// Asks before something that deletes (a template, or this month's pending expense). A refusal is
// not shown here: the dialog closes and the reason is put under the row it concerns.
export function ConfirmRowDialog({
  isOpen,
  onOpenChange,
  onClose,
  row,
  copy,
  onConfirm,
  onFailure,
}: ConfirmRowDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    if (!row) {
      return;
    }

    startTransition(async () => {
      const result = await onConfirm(row.id);

      if (result.status === "error") {
        onFailure(row.id, result.message);
      }

      onClose();
    });
  };

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{copy.heading}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{row ? copy.body(row.description) : null}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" isDisabled={isPending} onPress={onClose}>
              {CANCEL_LABEL}
            </Button>
            <PendingButton
              variant="danger"
              isPending={isPending}
              label={copy.confirmLabel}
              pendingLabel={copy.pendingLabel}
              onPress={handleConfirm}
            />
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
