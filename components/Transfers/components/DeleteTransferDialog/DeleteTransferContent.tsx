import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteTransferAction } from "@/core/transfers/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING,
  DELETE_WARNING,
  transferSummary,
} from "./consts";
import type { DeleteTransferContentProps } from "./types";

// Mounted with the transfer id as key, so a previous failure never leaks into another row.
export function DeleteTransferContent({
  transfer,
  onClose,
  onDeleting,
}: DeleteTransferContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!transfer) {
      return;
    }

    // Inside the transition, before the delete is awaited: the row reads as on its way out until the
    // refreshed rows arrive (or the delete fails and the transition ends).
    startTransition(async () => {
      onDeleting([transfer.id]);

      const result = await deleteTransferAction(transfer.id);

      if (result.status === "success") {
        onClose();

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
        <AlertDialog.Heading>{DELETE_HEADING}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>
          {transfer
            ? `${transferSummary(transfer.fromLabel, transfer.toLabel, transfer.amountLabel)} `
            : null}
          {DELETE_WARNING}
        </p>
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
