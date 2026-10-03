import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteCardAction } from "@/core/cards/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING_FALLBACK,
  DELETE_WARNING,
  deleteHeading,
} from "./consts";
import type { DeleteCardContentProps } from "./types";

// Mounted with the card id as key, so a previous failure never leaks into another card.
export function DeleteCardContent({
  card,
  onClose,
  onDeleting,
}: DeleteCardContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!card) {
      return;
    }

    // Inside the transition, before the delete is awaited: the row reads as on its way out until the
    // refreshed rows arrive (or the delete fails and the transition ends).
    startTransition(async () => {
      onDeleting([card.id]);

      const result = await deleteCardAction(card.id);

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
        <AlertDialog.Heading>
          {card ? deleteHeading(card.title) : DELETE_HEADING_FALLBACK}
        </AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>{DELETE_WARNING}</p>
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
