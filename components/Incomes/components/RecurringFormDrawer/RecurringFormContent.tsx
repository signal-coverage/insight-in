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
  TextArea,
  TextField,
} from "@heroui/react";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  createCategoryAction,
  createRecurringIncomeAction,
  updateRecurringIncomeAction,
} from "@/core/incomes/actions";
import {
  DEFAULT_CURRENCY_CODE,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";
import type { IncomeFieldErrors } from "@/core/incomes/types";

import {
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import {
  AccountField,
  resolveAccountId,
} from "@/components/Entries/components/AccountField";
import { DESCRIPTION_PLACEHOLDER } from "../IncomeFormDrawer/consts";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DESCRIPTION_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import { AMOUNT_ROW_CLASS_NAME } from "@/components/Entries/styles";
import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";
import {
  CANCEL_LABEL,
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DEFAULT_FREQUENCY,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  END_DATE_HINT,
  END_DATE_LABEL,
  FORM_ID,
  FREQUENCIES,
  FREQUENCY_LABEL,
  FREQUENCY_PLACEHOLDER,
  START_DATE_HINT,
  START_DATE_LABEL,
} from "./consts";
import type { RecurringFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function RecurringFormContent({
  target,
  categories,
  accounts,
  onClose,
}: RecurringFormContentProps) {
  const { recurring, defaultDate } = target;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<IncomeFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // The currency is kept in state because the account choice depends on it; a currency change drops
  // the account, an edit keeps the template's own (even archived).
  const [currency, setCurrency] = useState(
    recurring?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  const keepAccountId = recurring?.accountId ?? null;
  const [accountId, setAccountId] = useState<string | null>(keepAccountId);
  const account = resolveAccountId(
    accounts,
    currency,
    accountId,
    keepAccountId,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = recurring
        ? await updateRecurringIncomeAction(recurring.id, formData)
        : await createRecurringIncomeAction(formData);

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
          {recurring ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {recurring ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
        </p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <TextField
            isRequired
            className={FIELD_CLASS_NAME}
            name="description"
            maxLength={DESCRIPTION_MAX_LENGTH}
            defaultValue={recurring?.description}
          >
            <Label>{DESCRIPTION_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={DESCRIPTION_PLACEHOLDER}
            />
            <FieldError />
          </TextField>

          <div className={AMOUNT_ROW_CLASS_NAME}>
            <TextField
              isRequired
              className={FIELD_CLASS_NAME}
              name="amount"
              inputMode="decimal"
              defaultValue={recurring?.amountDecimal}
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
              isRequired
              variant={FIELD_VARIANT}
              className={FIELD_CLASS_NAME}
              name="currency"
              placeholder={CURRENCY_PLACEHOLDER}
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  setCurrency(value);
                  setAccountId(null);
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

          <CategoryField
            categories={categories}
            defaultCategoryId={recurring?.categoryId ?? null}
            onCreate={createCategoryAction}
          />

          <AccountField
            accounts={accounts}
            currency={currency}
            value={account}
            keepAccountId={keepAccountId}
            onChange={setAccountId}
            errorMessage={fieldErrors.accountId?.[0]}
          />

          <Select
            isRequired
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name="frequency"
            placeholder={FREQUENCY_PLACEHOLDER}
            defaultValue={recurring?.frequency ?? DEFAULT_FREQUENCY}
          >
            <Label>{FREQUENCY_LABEL}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {FREQUENCIES.map(([value, label]) => (
                  <ListBox.Item key={value} id={value} textValue={label}>
                    {label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
            <FieldError />
          </Select>

          <div className={AMOUNT_ROW_CLASS_NAME}>
            <DatePickerField
              isRequired
              name="startDate"
              label={START_DATE_LABEL}
              description={START_DATE_HINT}
              defaultValue={recurring?.startDate ?? defaultDate}
            />

            <DatePickerField
              name="endDate"
              label={END_DATE_LABEL}
              description={END_DATE_HINT}
              defaultValue={recurring?.endDate ?? null}
            />
          </div>

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={recurring?.notes ?? ""}
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
          Icon={recurring ? undefined : PlusIcon}
          label={recurring ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={recurring ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
