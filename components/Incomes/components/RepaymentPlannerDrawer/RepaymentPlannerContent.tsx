import { Button, Drawer } from "@heroui/react";
import { useState, useTransition } from "react";

import { InstallmentTicket } from "@/components/Entries/components/InstallmentTicket";
import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import { DRAWER_DESCRIPTION_CLASS_NAME } from "@/components/Entries/styles";
import { firstError } from "@/components/Entries/utils";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { createInstallmentPlanAction } from "@/core/installments/actions";

import { RepaymentForm } from "./components/RepaymentForm";
import {
  BACK_LABEL,
  CONTINUE_LABEL,
  HEADING,
  REPAYMENT_STEP_LABEL,
  REVIEW_STEP_LABEL,
  SAVE_LABEL,
  SAVE_PENDING_LABEL,
  saveQuestion,
  SUMMARY_HEADING,
  TICKET_BRAND,
} from "./consts";
import { QUESTION_CLASS_NAME, REVIEW_CLASS_NAME } from "./styles";
import type {
  RepaymentPlannerContentProps,
  RepaymentStep,
  RepaymentValues,
} from "./types";
import {
  initialValues,
  parseRepayment,
  previewText,
  toPayload,
  toTicketLines,
  withRepaymentChange,
} from "./utils";

// Mounted with a fresh key on every opening, so each one starts from the defaults. The data of the
// repayment, then a ticket to review before anything is written. Kept in local state.
export function RepaymentPlannerContent({
  categories,
  accounts,
  defaultDate,
  onClose,
}: RepaymentPlannerContentProps) {
  const [step, setStep] = useState<RepaymentStep>("repayment");
  const [values, setValues] = useState<RepaymentValues>(() =>
    initialValues(defaultDate),
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const summary = parseRepayment(values, accounts);
  const categoryName =
    categories.find(({ id }) => id === values.categoryId)?.name ?? "";

  const handleChange = (patch: Partial<RepaymentValues>) =>
    setValues((current) => withRepaymentChange(current, patch));

  const handleSave = () => {
    startTransition(async () => {
      const result = await createInstallmentPlanAction(
        toPayload(values, accounts),
      );

      if (result.status === "success") {
        onClose();

        return;
      }

      setError(firstError(result));
    });
  };

  const isRepaymentStep = step === "repayment" || !summary;
  const stepLabel = {
    repayment: REPAYMENT_STEP_LABEL,
    review: REVIEW_STEP_LABEL,
  }[step];

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{stepLabel}</p>
      </Drawer.Header>
      <Drawer.Body>
        {isRepaymentStep ? (
          <RepaymentForm
            values={values}
            categories={categories}
            accounts={accounts}
            preview={summary ? previewText(summary) : null}
            onChange={handleChange}
          />
        ) : (
          <div className={REVIEW_CLASS_NAME}>
            <InstallmentTicket
              brand={TICKET_BRAND}
              heading={SUMMARY_HEADING}
              lines={toTicketLines(summary, categoryName)}
            />
            <p className={QUESTION_CLASS_NAME}>
              {saveQuestion(summary.input.totalCuotas)}
            </p>
            {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          </div>
        )}
      </Drawer.Body>
      <Drawer.Footer>
        {isRepaymentStep ? (
          <>
            <Button slot="close" variant="tertiary">
              {CANCEL_LABEL}
            </Button>
            <Button
              isDisabled={!summary}
              onPress={() => {
                setError(null);
                setStep("review");
              }}
            >
              {CONTINUE_LABEL}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="tertiary"
              isDisabled={isPending}
              onPress={() => {
                setError(null);
                setStep("repayment");
              }}
            >
              {BACK_LABEL}
            </Button>
            <PendingButton
              isPending={isPending}
              label={SAVE_LABEL}
              pendingLabel={SAVE_PENDING_LABEL}
              onPress={handleSave}
            />
          </>
        )}
      </Drawer.Footer>
    </>
  );
}
