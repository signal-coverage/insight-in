import { PlusIcon } from "@heroicons/react/24/outline";
import { Button, Drawer, Form } from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CANCEL_LABEL } from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
  FORM_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { createCardAction, updateCardAction } from "@/core/cards/actions";
import type { CardFieldErrors } from "@/core/cards/types";

import { BankField } from "./components/BankField";
import { BrandField } from "./components/BrandField";
import { CardIdentity } from "./components/CardIdentity";
import { CardPreview } from "./components/CardPreview";
import { DayField } from "./components/DayField";
import { KindField } from "./components/KindField";
import { Last4Field } from "./components/Last4Field";
import { LimitModeField } from "./components/LimitModeField";
import { LimitsField } from "./components/LimitsField";
import {
  CLOSING_DAY_FIELD_NAME,
  CLOSING_DAY_HINT,
  CLOSING_DAY_LABEL,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DEFAULT_LIMIT_MODE,
  DUE_DAY_FIELD_NAME,
  DUE_DAY_HINT,
  DUE_DAY_LABEL,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
} from "./consts";
import type { CardFormContentProps } from "./types";
import { useCardDraft } from "./useCardDraft";

// Mounted with a fresh key on every opening, so field defaults and errors always reset. A new card
// chooses its kind and bank; an edit shows them and sends them back unchanged. Only a credit card has
// the cycle, the kind of cap and the caps per currency.
export function CardFormContent({
  target,
  banks,
  onClose,
}: CardFormContentProps) {
  const { card } = target;
  const draft = useCardDraft(card);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const isCredit = draft.kind === "CREDIT";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = card
        ? await updateCardAction(card.id, formData)
        : await createCardAction(formData);

      if (result.status === "success") {
        onClose();

        return;
      }

      setFieldErrors(result.fieldErrors ?? {});
      setFormError(result.fieldErrors ? null : result.message);
    });
  };

  return (
    <>
      <Drawer.CloseTrigger />
      <Drawer.Header>
        <Drawer.Heading>{card ? EDIT_HEADING : CREATE_HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {card ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <CardPreview
            brand={draft.brand}
            last4={draft.last4}
            cycle={
              isCredit
                ? { closingDay: draft.closingDay, dueDay: draft.dueDay }
                : null
            }
          />

          {card ? (
            <CardIdentity
              kind={card.kind}
              bankId={card.bankId}
              bankName={card.bankName}
              errorMessage={fieldErrors.kind?.[0] ?? fieldErrors.bankId?.[0]}
            />
          ) : (
            <>
              <KindField value={draft.kind} onChange={draft.setKind} />
              <BankField banks={banks} />
            </>
          )}

          <Last4Field value={draft.last4} onChange={draft.setLast4} />

          <BrandField value={draft.brand} onChange={draft.setBrand} />

          {isCredit ? (
            <>
              <div className={AMOUNT_ROW_CLASS_NAME}>
                <DayField
                  name={CLOSING_DAY_FIELD_NAME}
                  label={CLOSING_DAY_LABEL}
                  hint={CLOSING_DAY_HINT}
                  value={draft.closingDay}
                  onChange={draft.setClosingDay}
                />
                <DayField
                  name={DUE_DAY_FIELD_NAME}
                  label={DUE_DAY_LABEL}
                  hint={DUE_DAY_HINT}
                  value={draft.dueDay}
                  onChange={draft.setDueDay}
                />
              </div>

              <LimitModeField
                defaultMode={card?.limitMode ?? DEFAULT_LIMIT_MODE}
              />

              <LimitsField
                defaultLimits={card?.limits ?? []}
                fieldErrors={fieldErrors}
              />
            </>
          ) : null}

          {formError ? (
            <InlineAlert variant="error">{formError}</InlineAlert>
          ) : null}
        </Form>
      </Drawer.Body>
      <Drawer.Footer>
        <Button slot="close" variant="tertiary" isDisabled={isPending}>
          {CANCEL_LABEL}
        </Button>
        <PendingButton
          type="submit"
          form={FORM_ID}
          isPending={isPending}
          Icon={card ? undefined : PlusIcon}
          label={card ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={card ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
