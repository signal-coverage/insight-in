import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";

import {
  CANCEL_LABEL,
  CLOSE_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_WARNING,
  UNEXPECTED_ERROR_MESSAGE,
} from "./consts";
import type { BulkDeleteContentProps } from "./types";

// Mounted with the ids as key, so a previous failure never leaks into another selection.
export function BulkDeleteContent({
  ids,
  copy,
  action,
  onDeleting,
  onDeleted,
  onClose,
}: BulkDeleteContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Set when some rows were left out: the dialog then stays to say so, with nothing left to confirm.
  const [partialResult, setPartialResult] = useState<string | null>(null);

  // The delete runs inside the transition, with the rows marked as going away first: they stay
  // marked until the refreshed rows commit (or the delete fails and the transition ends).
  const handleConfirm = () => {
    startTransition(async () => {
      onDeleting(ids);

      try {
        const result = await action([...ids]);

        if (result.status === "error") {
          setError(result.message);

          return;
        }

        if (result.deleted > 0) {
          onDeleted();
        }

        if (result.skipped && copy.partialResult) {
          setPartialResult(copy.partialResult(result.deleted, result.skipped));

          return;
        }

        onClose();
      } catch {
        setError(UNEXPECTED_ERROR_MESSAGE);
      }
    });
  };

  return (
    <>
      <AlertDialog.CloseTrigger />
      <AlertDialog.Header>
        <AlertDialog.Icon status="danger" />
        <AlertDialog.Heading>{copy.heading(ids.length)}</AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>{DELETE_WARNING}</p>
        {partialResult ? (
          <InlineAlert variant="warning">{partialResult}</InlineAlert>
        ) : null}
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        {partialResult ? (
          <Button slot="close" variant="tertiary">
            {CLOSE_LABEL}
          </Button>
        ) : (
          <>
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
          </>
        )}
      </AlertDialog.Footer>
    </>
  );
}
