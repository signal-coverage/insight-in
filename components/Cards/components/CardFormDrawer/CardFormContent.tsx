import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import {
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { createCardAction, updateCardAction } from "@/core/cards/actions";
import type { CardFieldErrors } from "@/core/cards/types";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import { BrandField } from "./components/BrandField";
import { CardPreview } from "./components/CardPreview";
import { DayField } from "./components/DayField";
import { LimitModeField } from "./components/LimitModeField";
import { Last4Field } from "./components/Last4Field";
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
  LIMIT_AMOUNT_FIELD_NAME,
  LIMIT_AMOUNT_HINT,
  LIMIT_AMOUNT_LABEL,
} from "./consts";
import type { CardFormContentProps } from "./types";
import { useCardDraft } from "./useCardDraft";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function CardFormContent({ target, onClose }: CardFormContentProps) {
  const { card } = target;
  const draft = useCardDraft(card);
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<CardFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

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
            closingDay={draft.closingDay}
            dueDay={draft.dueDay}
          />

          <Last4Field value={draft.last4} onChange={draft.setLast4} />

          <BrandField value={draft.brand} onChange={draft.setBrand} />

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

          <Select
            isRequired
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name="currency"
            placeholder={CURRENCY_PLACEHOLDER}
            defaultValue={card?.currency ?? DEFAULT_CURRENCY_CODE}
          >
            <Label>{CURRENCY_LABEL}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {CURRENCY_OPTIONS.map(({ code, label }) => (
                  <ListBox.Item key={code} id={code} textValue={label}>
                    {label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError />
          </Select>

          <LimitModeField defaultMode={card?.limitMode ?? DEFAULT_LIMIT_MODE} />

          <TextField
            isRequired
            className={FIELD_CLASS_NAME}
            name={LIMIT_AMOUNT_FIELD_NAME}
            inputMode="decimal"
            defaultValue={card?.limitDecimal}
          >
            <Label>{LIMIT_AMOUNT_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder="0.00"
            />
            <Description>{LIMIT_AMOUNT_HINT}</Description>
            <FieldError />
          </TextField>

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
