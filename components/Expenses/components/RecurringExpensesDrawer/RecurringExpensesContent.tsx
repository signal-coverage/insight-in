import { Button, Drawer } from "@heroui/react";
import { useState, useTransition } from "react";

import { InstallmentsTable } from "@/components/Entries/components/InstallmentsTable";
import { DRAWER_DESCRIPTION_CLASS_NAME } from "@/components/Entries/styles";
import type { InstallmentCounts } from "@/components/Entries/types";
import { toInstallmentCounts } from "@/components/Entries/utils";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  applyRecurringDecisionsAction,
  removeRecurringExpenseAction,
  setRecurringDecisionAction,
} from "@/core/expenses/recurringActions";
import type { RecurringChoice } from "@/core/expenses/types";

import { ConfirmRowDialog } from "./components/ConfirmRowDialog";
import { RecurringTable } from "./components/RecurringTable";
import { TemplateFormDrawer } from "./components/TemplateFormDrawer";
import {
  APPLY_LABEL,
  APPLY_PENDING_LABEL,
  CANCEL_LABEL,
  DESCRIPTION,
  DISABLE_COPY,
  EMPTY_MESSAGE,
  heading,
  INSTALLMENTS_DESCRIPTION,
  INSTALLMENTS_HEADING,
  INSTALLMENTS_TABLE_COPY,
  RECURRING_HEADING,
  REMOVE_COPY,
} from "./consts";
import {
  BODY_CLASS_NAME,
  EMPTY_CLASS_NAME,
  SECTION_CLASS_NAME,
  SECTION_HEADING_CLASS_NAME,
} from "./styles";
import type { Amounts, Choices, RecurringExpensesContentProps } from "./types";
import { toDecisions } from "./utils";
import { useRowManagement } from "./useRowManagement";

// Mounted with a fresh key on every opening, so each one starts with no choice made. Nothing is
// written until "Aplicar": the choices live here, and one action applies them all, the recurring
// decisions and the installment counts together. Apart from that, every template can be edited,
// removed, or (once decided for the month) switched at any time, from the buttons of its row.
export function RecurringExpensesContent({
  data,
  categories,
  onClose,
}: RecurringExpensesContentProps) {
  const [choices, setChoices] = useState<Choices>({});
  const [amounts, setAmounts] = useState<Amounts>({});
  const [counts, setCounts] = useState<InstallmentCounts>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const management = useRowManagement();

  const rows = [...data.pending, ...data.decided];
  const hasPlans = data.plans.length > 0;
  const decisions = toDecisions(data.pending, choices, amounts);
  const installmentCounts = toInstallmentCounts(data.plans, counts);

  const handleChoiceChange = (id: string, choice: RecurringChoice) =>
    setChoices((current) => ({ ...current, [id]: choice }));

  const handleAmountChange = (id: string, value: string) =>
    setAmounts((current) => ({ ...current, [id]: value }));

  const handleCountChange = (id: string, value: number) =>
    setCounts((current) => ({ ...current, [id]: value }));

  const handleApply = () => {
    startTransition(async () => {
      const result = await applyRecurringDecisionsAction(
        decisions,
        installmentCounts,
      );

      if (result.status === "success") {
        onClose();

        return;
      }

      setError(result.message);
    });
  };

  const recurringTable = (
    <RecurringTable
      rows={rows}
      choices={choices}
      amounts={amounts}
      rowErrors={management.rowErrors}
      isDisabled={isPending}
      onChoiceChange={handleChoiceChange}
      onAmountChange={handleAmountChange}
      onEdit={management.openForm}
      onRemove={management.openRemove}
      onDisable={management.openDisable}
      onRowError={management.setRowError}
    />
  );

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{heading(data.monthLabel)}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {hasPlans
            ? `${DESCRIPTION} ${INSTALLMENTS_DESCRIPTION}`
            : DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <div className={BODY_CLASS_NAME}>
          {rows.length === 0 && !hasPlans ? (
            <p className={EMPTY_CLASS_NAME}>{EMPTY_MESSAGE}</p>
          ) : null}

          {rows.length > 0 && hasPlans ? (
            <section className={SECTION_CLASS_NAME}>
              <h3 className={SECTION_HEADING_CLASS_NAME}>
                {RECURRING_HEADING}
              </h3>
              {recurringTable}
            </section>
          ) : null}
          {rows.length > 0 && !hasPlans ? recurringTable : null}

          {hasPlans ? (
            <section className={SECTION_CLASS_NAME}>
              <h3 className={SECTION_HEADING_CLASS_NAME}>
                {INSTALLMENTS_HEADING}
              </h3>
              <InstallmentsTable
                copy={INSTALLMENTS_TABLE_COPY}
                rows={data.plans}
                counts={counts}
                isDisabled={isPending}
                onCountChange={handleCountChange}
              />
            </section>
          ) : null}
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          isDisabled={decisions.length === 0 && installmentCounts.length === 0}
          isPending={isPending}
          label={APPLY_LABEL}
          pendingLabel={APPLY_PENDING_LABEL}
          onPress={handleApply}
        />
      </Drawer.Footer>

      <TemplateFormDrawer
        isOpen={management.formState.isOpen}
        onOpenChange={management.formState.setOpen}
        onClose={management.formState.close}
        target={management.formTarget}
        categories={categories}
      />

      <ConfirmRowDialog
        isOpen={management.disableState.isOpen}
        onOpenChange={management.disableState.setOpen}
        onClose={management.disableState.close}
        row={management.toDisable}
        copy={DISABLE_COPY}
        onConfirm={(id) => setRecurringDecisionAction(id, "DISABLED")}
        onFailure={management.setRowError}
      />

      <ConfirmRowDialog
        isOpen={management.removeState.isOpen}
        onOpenChange={management.removeState.setOpen}
        onClose={management.removeState.close}
        row={management.toRemove}
        copy={REMOVE_COPY}
        onConfirm={removeRecurringExpenseAction}
        onFailure={management.setRowError}
      />
    </>
  );
}
