import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteExpenseAction } from "@/core/expenses/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  DELETE_HEADING,
  DELETE_WARNING,
} from "./consts";
import type { DeleteExpenseContentProps } from "./types";

// Mounted with the expense id as key, so a previous failure never leaks into another row.
export function DeleteExpenseContent({
  expense,
  onClose,
}: DeleteExpenseContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    if (!expense) {
      return;
    }

    startTransition(async () => {
      const result = await deleteExpenseAction(expense.id);

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
          {expense ? `${expense.description} (${expense.amountLabel}). ` : null}
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
