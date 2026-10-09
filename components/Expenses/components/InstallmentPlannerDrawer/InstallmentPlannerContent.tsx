import { Button, Drawer } from "@heroui/react";
import { useState, useTransition } from "react";

import { InstallmentTicket } from "@/components/Entries/components/InstallmentTicket";
import { DRAWER_DESCRIPTION_CLASS_NAME } from "@/components/Entries/styles";
import { firstError } from "@/components/Entries/utils";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { createInstallmentPlanAction } from "@/core/installments/actions";
import { monthOf } from "@/core/summary/month";

import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import { ConfirmCardDialog } from "./components/ConfirmCardDialog";
import { PurchaseForm } from "./components/PurchaseForm";
import {
  BACK_LABEL,
  CONTINUE_LABEL,
  HEADING,
  PURCHASE_STEP_LABEL,
  REVIEW_STEP_LABEL,
  SAVE_LABEL,
  SAVE_PENDING_LABEL,
  saveQuestion,
  SUMMARY_HEADING,
  TICKET_BRAND,
} from "./consts";
import { QUESTION_CLASS_NAME, REVIEW_CLASS_NAME } from "./styles";
import type {
  InstallmentPlannerContentProps,
  PlannerStep,
  PurchaseValues,
} from "./types";
import {
  confirmationText,
  firstInstallmentText,
  initialValues,
  needsConfirmation,
  parsePurchase,
  previewText,
  recommendationItems,
  toPayload,
  toTicketLines,
  withPurchaseChange,
} from "./utils";

// Mounted with a fresh key on every opening, so each one starts from the defaults. The data of the
// purchase, then a ticket to review before anything is written. When an own card charges the first
// installment this very month, saving asks first in a pop-up over the ticket. Kept in local state.
export function InstallmentPlannerContent({
  categories,
  cards,
  accounts,
  defaultDate,
  onClose,
}: InstallmentPlannerContentProps) {
  const [step, setStep] = useState<PlannerStep>("purchase");
  const [values, setValues] = useState<PurchaseValues>(() =>
    initialValues(defaultDate, cards),
  );
  const [error, setError] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  // "This month" is the month of the day the planner opened (the Argentine date).
  const currentMonth = monthOf(defaultDate);
  const summary = parsePurchase(values, cards, accounts);
  const categoryName =
    categories.find(({ id }) => id === values.categoryId)?.name ?? "";

  // A currency change leaves behind a card and an account of the old one.
  const handleChange = (patch: Partial<PurchaseValues>) =>
    setValues((current) => withPurchaseChange(current, patch, cards));

  const handleSave = () => {
    startTransition(async () => {
      const result = await createInstallmentPlanAction(
        toPayload(values, cards, accounts),
      );

      setIsConfirming(false);

      if (result.status === "success") {
        onClose();

        return;
      }

      setError(firstError(result));
    });
  };

  // Saving asks first, in a pop-up, when an own card charges the first installment this month.
  const handleReviewed = () => {
    if (summary && needsConfirmation(summary, currentMonth)) {
      setError(null);
      setIsConfirming(true);

      return;
    }

    handleSave();
  };

  const isPurchaseStep = step === "purchase" || !summary;
  const stepLabel = {
    purchase: PURCHASE_STEP_LABEL,
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
        {isPurchaseStep ? (
          <PurchaseForm
            values={values}
            categories={categories}
            cards={cards}
            accounts={accounts}
            preview={summary ? previewText(summary) : null}
            recommendations={recommendationItems(values, cards)}
            firstInstallment={firstInstallmentText(values, cards)}
            onChange={handleChange}
          />
        ) : (
          <div className={REVIEW_CLASS_NAME}>
            <InstallmentTicket
              brand={TICKET_BRAND}
              heading={SUMMARY_HEADING}
              lines={toTicketLines(summary, categoryName, currentMonth)}
            />
            <p className={QUESTION_CLASS_NAME}>
              {saveQuestion(summary.input.totalCuotas)}
            </p>
            {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}
          </div>
        )}
      </Drawer.Body>
      <Drawer.Footer>
        {isPurchaseStep ? (
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
                setStep("purchase");
              }}
            >
              {BACK_LABEL}
            </Button>
            <PendingButton
              isPending={isPending && !isConfirming}
              label={SAVE_LABEL}
              pendingLabel={SAVE_PENDING_LABEL}
              onPress={handleReviewed}
            />
          </>
        )}
      </Drawer.Footer>
      <ConfirmCardDialog
        isOpen={isConfirming}
        isPending={isPending}
        message={summary ? confirmationText(summary) : ""}
        onBack={() => setIsConfirming(false)}
        onConfirm={handleSave}
      />
    </>
  );
}
