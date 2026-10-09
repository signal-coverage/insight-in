import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";

import { CANCEL_LABEL, CONFIRM_LABEL, CONFIRM_PENDING_LABEL } from "./consts";
import type { ConfirmDeleteContentProps } from "./types";

// Mounted only while the dialog is open, so a refusal never leaks into the next opening.
export function ConfirmDeleteContent({
  heading,
  warning,
  onConfirm,
  onDeleted,
}: ConfirmDeleteContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await onConfirm();

      if (result.status === "success") {
        onDeleted();

        return;
      }

      setError(result.message);
    });
  };

  return (
    <>
      <AlertDialog.CloseTrigger />
      <AlertDialog.Header>
        <AlertDialog.Icon status="danger" />
        <AlertDialog.Heading>{heading}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>{warning}</p>
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
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
    </>
  );
}
