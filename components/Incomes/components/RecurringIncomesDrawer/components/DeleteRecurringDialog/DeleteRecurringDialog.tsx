import { AlertDialog, Button } from "@heroui/react";
import { useTransition } from "react";

import { PendingButton } from "@/components/shared/PendingButton";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING,
  DELETE_WARNING,
  FALLBACK_SUBJECT,
} from "./consts";
import { DIALOG_CLASS_NAME } from "./styles";
import type { DeleteRecurringDialogProps } from "./types";

export function DeleteRecurringDialog({
  isOpen,
  onOpenChange,
  onClose,
  recurring,
  onConfirm,
}: DeleteRecurringDialogProps) {
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      await onConfirm();
    });
  };

  return (
    <AlertDialog.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <AlertDialog.CloseTrigger />
          <AlertDialog.Header>
            <AlertDialog.Icon status="danger" />
            <AlertDialog.Heading>{DELETE_HEADING}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>
              {recurring ? `“${recurring.description}”` : FALLBACK_SUBJECT}{" "}
              {DELETE_WARNING}
            </p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" isDisabled={isPending} onPress={onClose}>
              {CANCEL_LABEL}
            </Button>
            <PendingButton
              variant="danger"
              isPending={isPending}
              label={CONFIRM_LABEL}
              pendingLabel={CONFIRM_PENDING_LABEL}
              onPress={handleConfirm}
            />
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
