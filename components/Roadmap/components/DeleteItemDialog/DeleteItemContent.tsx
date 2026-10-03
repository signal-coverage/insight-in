import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteItemAction } from "@/core/roadmap/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING_FALLBACK,
  DELETE_WARNING,
  deleteHeading,
} from "./consts";
import type { DeleteItemContentProps } from "./types";

// Mounted with the card id as key, so a previous failure never leaks into another card.
export function DeleteItemContent({ item, onClose }: DeleteItemContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!item) {
      return;
    }

    startTransition(async () => {
      const result = await deleteItemAction(item.id);

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
          {item ? deleteHeading(item.title) : DELETE_HEADING_FALLBACK}
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
