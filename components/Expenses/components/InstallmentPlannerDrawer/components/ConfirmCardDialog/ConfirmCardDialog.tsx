import { AlertDialog, Button } from "@heroui/react";

import { PendingButton } from "@/components/shared/PendingButton";

import {
  BACK_LABEL,
  CONFIRM_HEADING,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
} from "./consts";
import { DIALOG_CLASS_NAME } from "./styles";
import type { ConfirmCardDialogProps } from "./types";

// The pop-up that grabs the user's attention before an own card is used for a purchase whose first
// installment is charged this very month. It is not dismissable by the backdrop or the keyboard:
// the answer is one of its two buttons.
export function ConfirmCardDialog({
  isOpen,
  isPending,
  message,
  onBack,
  onConfirm,
}: ConfirmCardDialogProps) {
  return (
    <AlertDialog.Backdrop
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isPending) {
          onBack();
        }
      }}
    >
      <AlertDialog.Container>
        <AlertDialog.Dialog className={DIALOG_CLASS_NAME}>
          <AlertDialog.Header>
            <AlertDialog.Icon status="warning" />
            <AlertDialog.Heading>{CONFIRM_HEADING}</AlertDialog.Heading>
          </AlertDialog.Header>
          <AlertDialog.Body>
            <p>{message}</p>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button variant="tertiary" isDisabled={isPending} onPress={onBack}>
              {BACK_LABEL}
            </Button>
            <PendingButton
              isPending={isPending}
              label={CONFIRM_LABEL}
              pendingLabel={CONFIRM_PENDING_LABEL}
              onPress={onConfirm}
            />
          </AlertDialog.Footer>
        </AlertDialog.Dialog>
      </AlertDialog.Container>
    </AlertDialog.Backdrop>
  );
}
