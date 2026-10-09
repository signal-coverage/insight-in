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
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { OriginSection } from "@/components/Entries/components/OriginSection";
import { CurrencyListBox } from "@/components/Entries/components/CurrencyListBox";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DESCRIPTION_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
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
import { createCategoryAction } from "@/core/expenses/actions";
import { updateRecurringExpenseAction } from "@/core/expenses/recurringActions";
import type { ExpenseFieldErrors } from "@/core/expenses/types";
import {
  DEFAULT_CURRENCY_CODE,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";

import { ORIGIN_SECTION_COPY } from "../../../../consts";
import {
  DAY_HINT,
  DAY_LABEL,
  DAY_PLACEHOLDER,
  DESCRIPTION,
  DESCRIPTION_PLACEHOLDER,
  FORM_ID,
  HEADING,
  PENDING_LABEL,
  SUBMIT_LABEL,
} from "./consts";
import type { TemplateFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset. It only
// ever edits the template: the expenses already created from it are not part of this form.
export function TemplateFormContent({
  template,
  categories,
  accounts,
  onClose,
}: TemplateFormContentProps) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Kept in state because the origin section works out the implied rate from them, and offers every
  // currency but the one of the template.
  const [amount, setAmount] = useState(template.amountDecimal);
  const [currency, setCurrency] = useState(
    template.currency || DEFAULT_CURRENCY_CODE,
  );
  // The account the month's expense goes to: the template keeps its own, even if it was archived
  // since; a currency change drops it.
  const keepAccountId = template.accountId;
  const [accountId, setAccountId] = useState<string | null>(keepAccountId);
  const account = resolveAccountId(
    accounts,
    currency,
    accountId,
    keepAccountId,
  );
  const hasOriginErrors = Boolean(
    fieldErrors.originCurrency || fieldErrors.originAmount,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = await updateRecurringExpenseAction(template.id, formData);

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
        <Drawer.Heading>{HEADING}</Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>{DESCRIPTION}</p>
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
            defaultValue={template.description}
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
              value={amount}
              onChange={setAmount}
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

          <OriginSection
            copy={ORIGIN_SECTION_COPY}
            netAmount={amount}
            netCurrency={currency}
            defaultCurrency={template.originCurrency}
            defaultAmount={template.originAmountDecimal}
            hasErrors={hasOriginErrors}
          />

          <CategoryField
            categories={categories}
            defaultCategoryId={template.categoryId}
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

          <TextField
            isRequired
            className={FIELD_CLASS_NAME}
            name="dayOfMonth"
            inputMode="numeric"
            defaultValue={String(template.dayOfMonth)}
          >
            <Label>{DAY_LABEL}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={DAY_PLACEHOLDER}
            />
            <Description>{DAY_HINT}</Description>
            <FieldError />
          </TextField>

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={template.notes ?? ""}
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
          label={SUBMIT_LABEL}
          pendingLabel={PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
