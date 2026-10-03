import { AlertDialog, Button } from "@heroui/react";
import { useState, useTransition } from "react";

import { InstallmentDeleteChoice } from "@/components/Entries/components/InstallmentDeleteChoice";
import { useDeleteScope } from "@/components/Entries/useDeleteScope";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { deleteExpenseAction } from "@/core/expenses/actions";
import { deleteInstallmentPlanAction } from "@/core/installments/actions";

import {
  CANCEL_LABEL,
  CONFIRM_LABEL,
  CONFIRM_PENDING_LABEL,
  CONFIRM_PLAN_LABEL,
  DELETE_HEADING,
  DELETE_PLAN_HEADING,
  DELETE_WARNING,
} from "./consts";
import type { DeleteExpenseContentProps } from "./types";

// Mounted with the expense id as key, so a previous failure never leaks into another row.
export function DeleteExpenseContent({
  expense,
  onClose,
  onDeleting,
  onDeletingPlan,
}: DeleteExpenseContentProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { scope, selectScope, acknowledged, setAcknowledged, canConfirm } =
    useDeleteScope();

  // An installment of a plan can take its whole plan with it, but only when the plan's progress is known
  // (it is what the choice quotes).
  const planId = expense?.installmentPlanId ?? null;
  const progress = expense?.planProgress ?? null;
  const hasChoice = planId !== null && progress !== null;
  const isPlan = hasChoice && scope === "plan";

  const handleConfirm = () => {
    if (!expense) {
      return;
    }

    // Inside the transition, before the delete is awaited: the row (or every row of the plan) reads as
    // on its way out until the refreshed rows arrive (or the delete fails and the transition ends).
    startTransition(async () => {
      let result;

      if (isPlan && planId) {
        onDeletingPlan(planId);
        result = await deleteInstallmentPlanAction(planId);
      } else {
        onDeleting([expense.id]);
        result = await deleteExpenseAction(expense.id);
      }

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
          {isPlan ? DELETE_PLAN_HEADING : DELETE_HEADING}
        </AlertDialog.Heading>
      </AlertDialog.Header>
      <AlertDialog.Body>
        <p>
          {expense ? `${expense.description} (${expense.amountLabel}). ` : null}
          {DELETE_WARNING}
        </p>
        {hasChoice ? (
          <InstallmentDeleteChoice
            side="expense"
            progress={progress}
            scope={scope}
            onScopeChange={selectScope}
            acknowledged={acknowledged}
            onAcknowledgedChange={setAcknowledged}
            isDisabled={isPending}
          />
        ) : null}
        {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
      </AlertDialog.Body>
      <AlertDialog.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          variant="danger"
          isPending={isPending}
          isDisabled={!canConfirm}
          label={isPlan ? CONFIRM_PLAN_LABEL : CONFIRM_LABEL}
          pendingLabel={CONFIRM_PENDING_LABEL}
          onPress={handleConfirm}
        />
      </AlertDialog.Footer>
    </>
  );
}
