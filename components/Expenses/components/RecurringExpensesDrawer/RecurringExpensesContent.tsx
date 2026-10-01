import { Button, Drawer } from "@heroui/react";
import { useState, useTransition } from "react";

import { DRAWER_DESCRIPTION_CLASS_NAME } from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { applyRecurringDecisionsAction } from "@/core/expenses/recurringActions";
import type { RecurringChoice } from "@/core/expenses/types";

import { RecurringTable } from "./components/RecurringTable";
import {
  APPLY_LABEL,
  APPLY_PENDING_LABEL,
  CANCEL_LABEL,
  DESCRIPTION,
  EMPTY_MESSAGE,
  heading,
} from "./consts";
import { BODY_CLASS_NAME, EMPTY_CLASS_NAME } from "./styles";
import type { Amounts, Choices, RecurringExpensesContentProps } from "./types";
import { toDecisions } from "./utils";

// Mounted with a fresh key on every opening, so each one starts with no choice made. Nothing is
// written until "Aplicar": the choices live here, and one action applies them all.
export function RecurringExpensesContent({
  data,
  onClose,
}: RecurringExpensesContentProps) {
  const [choices, setChoices] = useState<Choices>({});
  const [amounts, setAmounts] = useState<Amounts>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const rows = [...data.pending, ...data.decided];
  const decisions = toDecisions(data.pending, choices, amounts);

  const handleChoiceChange = (id: string, choice: RecurringChoice) =>
    setChoices((current) => ({ ...current, [id]: choice }));

  const handleAmountChange = (id: string, value: string) =>
    setAmounts((current) => ({ ...current, [id]: value }));

  const handleApply = () => {
    startTransition(async () => {
      const result = await applyRecurringDecisionsAction(decisions);

      if (result.status === "success") {
        onClose();

        return;
      }

      setError(result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{heading(data.monthLabel)}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{DESCRIPTION}</p>
      </Drawer.Header>
      <Drawer.Body>
        <div className={BODY_CLASS_NAME}>
          {rows.length === 0 ? (
            <p className={EMPTY_CLASS_NAME}>{EMPTY_MESSAGE}</p>
          ) : (
            <RecurringTable
              rows={rows}
              choices={choices}
              amounts={amounts}
              isDisabled={isPending}
              onChoiceChange={handleChoiceChange}
              onAmountChange={handleAmountChange}
            />
          )}
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          isDisabled={decisions.length === 0}
          isPending={isPending}
          label={APPLY_LABEL}
          pendingLabel={APPLY_PENDING_LABEL}
          onPress={handleApply}
        />
      </Drawer.Footer>
    </>
  );
}
