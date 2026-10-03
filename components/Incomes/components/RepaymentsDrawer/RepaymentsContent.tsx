import { Button, Drawer } from "@heroui/react";
import { useState, useTransition } from "react";

import { InstallmentsTable } from "@/components/Entries/components/InstallmentsTable";
import { DRAWER_DESCRIPTION_CLASS_NAME } from "@/components/Entries/styles";
import type { InstallmentCounts } from "@/components/Entries/types";
import { toInstallmentCounts } from "@/components/Entries/utils";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { applyIncomeInstallmentCountsAction } from "@/core/installments/actions";

import {
  APPLY_LABEL,
  APPLY_PENDING_LABEL,
  CANCEL_LABEL,
  DESCRIPTION,
  EMPTY_MESSAGE,
  heading,
  TABLE_COPY,
} from "./consts";
import { BODY_CLASS_NAME, EMPTY_CLASS_NAME } from "./styles";
import type { RepaymentsContentProps } from "./types";

// Mounted with a fresh key on every opening, so each one starts with no choice made. Nothing is
// written until "Aplicar": the counts live here, and one action applies them all.
export function RepaymentsContent({ data, onClose }: RepaymentsContentProps) {
  const [counts, setCounts] = useState<InstallmentCounts>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const installmentCounts = toInstallmentCounts(data.plans, counts);

  const handleApply = () => {
    startTransition(async () => {
      const result =
        await applyIncomeInstallmentCountsAction(installmentCounts);

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
          {data.plans.length === 0 ? (
            <p className={EMPTY_CLASS_NAME}>{EMPTY_MESSAGE}</p>
          ) : (
            <InstallmentsTable
              copy={TABLE_COPY}
              rows={data.plans}
              counts={counts}
              isDisabled={isPending}
              onCountChange={(id, value) =>
                setCounts((current) => ({ ...current, [id]: value }))
              }
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
          isDisabled={installmentCounts.length === 0}
          isPending={isPending}
          label={APPLY_LABEL}
          pendingLabel={APPLY_PENDING_LABEL}
          onPress={handleApply}
        />
      </Drawer.Footer>
    </>
  );
}
