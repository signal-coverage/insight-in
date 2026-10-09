import { PlusIcon } from "@heroicons/react/24/outline";
import {
  Button,
  Description,
  Drawer,
  FieldError,
  Form,
  Input,
  Label,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  AccountField,
  resolveAccountId,
} from "@/components/Entries/components/AccountField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DATE_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { useServerFieldErrors } from "@/components/Entries/useServerFieldErrors";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { DEFAULT_CURRENCY_CODE, NOTES_MAX_LENGTH } from "@/core/incomes/consts";
import {
  createTransferAction,
  updateTransferAction,
} from "@/core/transfers/actions";
import type { TransferFieldErrors } from "@/core/transfers/types";

import {
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
  FROM_FIELD_NAME,
  FROM_LABEL,
  TO_FIELD_NAME,
  TO_LABEL,
  toEmptyHint,
} from "./consts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FORM_CLASS_NAME,
} from "./styles";
import type { TransferFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function TransferFormContent({
  target,
  accounts,
  onClose,
}: TransferFormContentProps) {
  const { transfer, defaultDate } = target;
  const [isPending, startTransition] = useTransition();
  // The refusals of the server stay until the input that caused them changes: see clearFieldErrors.
  const { fieldErrors, setFieldErrors, clearFieldErrors } =
    useServerFieldErrors<TransferFieldErrors>();
  const [formError, setFormError] = useState<string | null>(null);
  const [currency, setCurrency] = useState(
    transfer?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  // An edit keeps the accounts the transfer already has on their sides, even if archived since; a
  // currency change drops both choices.
  const keepFromId = transfer?.fromAccountId ?? null;
  const keepToId = transfer?.toAccountId ?? null;
  const [fromId, setFromId] = useState<string | null>(keepFromId);
  const [toId, setToId] = useState<string | null>(keepToId);
  const from = resolveAccountId(accounts, currency, fromId, keepFromId);
  // The destination never offers the source.
  const to = resolveAccountId(accounts, currency, toId, keepToId, from);

  // Both accounts, the currency and the date can change the server's verdict (funds, archived
  // account), so changing any of them drops the refusals.
  const handleFromChange = (next: string | null) => {
    setFromId(next);
    clearFieldErrors();
  };

  const handleToChange = (next: string | null) => {
    setToId(next);
    clearFieldErrors();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = transfer
        ? await updateTransferAction(transfer.id, formData)
        : await createTransferAction(formData);

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
        <Drawer.Heading>
          {transfer ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DESCRIPTION_CLASS_NAME}>
          {transfer ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <div className={AMOUNT_ROW_CLASS_NAME}>
            <TextField
              isRequired
              className={FIELD_CLASS_NAME}
              name="amount"
              inputMode="decimal"
              defaultValue={transfer?.amountDecimal ?? ""}
            >
              <Label>{AMOUNT_LABEL}</Label>
              <Input
                variant={FIELD_VARIANT}
                className={FIELD_HEIGHT_CLASS_NAME}
                placeholder={AMOUNT_PLACEHOLDER}
              />
              <Description>{AMOUNT_HINT}</Description>
              <FieldError />
            </TextField>

            <Select
              variant={FIELD_VARIANT}
              isRequired
              className={FIELD_CLASS_NAME}
              name="currency"
              placeholder={CURRENCY_PLACEHOLDER}
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  setCurrency(value);
                  setFromId(null);
                  setToId(null);
                  clearFieldErrors();
                }
              }}
            >
              <Label>{CURRENCY_LABEL}</Label>
              <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <CurrencyListBox includeCrypto />
              </Select.Popover>
              <FieldError />
            </Select>
          </div>

          <AccountField
            accounts={accounts}
            currency={currency}
            value={from}
            keepAccountId={keepFromId}
            name={FROM_FIELD_NAME}
            label={FROM_LABEL}
            onChange={handleFromChange}
            errorMessage={fieldErrors.fromAccountId?.[0]}
          />

          <AccountField
            accounts={accounts}
            currency={currency}
            value={to}
            keepAccountId={keepToId}
            excludeAccountId={from}
            name={TO_FIELD_NAME}
            label={TO_LABEL}
            emptyHint={toEmptyHint(currency)}
            onChange={handleToChange}
            errorMessage={fieldErrors.toAccountId?.[0]}
          />

          <DatePickerField
            isRequired
            name="date"
            label={DATE_LABEL}
            defaultValue={transfer?.date ?? defaultDate}
            onChange={clearFieldErrors}
          />

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={transfer?.notes ?? ""}
          >
            <Label>{NOTES_LABEL}</Label>
            <TextArea
              variant={FIELD_VARIANT}
              placeholder={NOTES_PLACEHOLDER}
              rows={3}
            />
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
          Icon={transfer ? undefined : PlusIcon}
          label={transfer ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={transfer ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
