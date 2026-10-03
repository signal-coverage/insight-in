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
import { MediumField } from "@/components/Entries/components/MediumField";
import { StatusSwitch } from "@/components/Entries/components/StatusSwitch";
import { DEFAULT_PAYMENT_MEDIUM } from "@/core/entries/medium";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  createCategoryAction,
  createIncomeAction,
  updateIncomeAction,
} from "@/core/incomes/actions";
import {
  DEFAULT_CURRENCY_CODE,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";
import type { IncomeFieldErrors } from "@/core/incomes/types";

import {
  CREATE_DESCRIPTION,
  CREATE_HEADING,
  CREATE_PENDING_LABEL,
  CREATE_SUBMIT_LABEL,
  DESCRIPTION_PLACEHOLDER,
  EDIT_DESCRIPTION,
  EDIT_HEADING,
  EDIT_PENDING_LABEL,
  EDIT_SUBMIT_LABEL,
  FORM_ID,
} from "./consts";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CANCEL_LABEL,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
  DATE_LABEL,
  DESCRIPTION_LABEL,
  NOTES_LABEL,
  NOTES_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FORM_CLASS_NAME,
} from "./styles";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import { OriginSection } from "@/components/Entries/components/OriginSection";
import { ORIGIN_SECTION_COPY, STATUS_SWITCH_LABEL } from "../../consts";
import { CategoryField } from "@/components/Entries/components/CategoryField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import type { IncomeFormContentProps } from "./types";
import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import {
  ReimbursesField,
  REIMBURSES_FIELD,
} from "./components/ReimbursesField";
import { reimbursableChoices } from "./utils";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function IncomeFormContent({
  target,
  categories,
  reimbursables,
  onClose,
}: IncomeFormContentProps) {
  const { income, defaultDate } = target;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<IncomeFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  // Kept in state because the origin section works out the implied rate from them, and offers
  // every currency but the one of the net amount.
  const [amount, setAmount] = useState(income?.amountDecimal ?? "");
  const [currency, setCurrency] = useState(
    income?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  // The expense this income pays back. An installment of a loan repaid in cuotas has no such link, and
  // an expense in another currency than the income is never kept as the choice.
  const [reimbursesId, setReimbursesId] = useState<string | null>(
    income?.reimbursesExpenseId ?? null,
  );
  const choices = reimbursableChoices(reimbursables, income);
  const reimbursed = choices.find(
    (option) => option.id === reimbursesId && option.currency === currency,
  );
  const canReimburse =
    (income === null || income.installmentPlanId === null) &&
    choices.some((option) => option.currency === currency);
  const hasOriginErrors = Boolean(
    fieldErrors.originCurrency || fieldErrors.originAmount,
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = income
        ? await updateIncomeAction(income.id, formData)
        : await createIncomeAction(formData);

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
          {income ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DESCRIPTION_CLASS_NAME}>
          {income ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
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
            defaultValue={income?.description}
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
              variant={FIELD_VARIANT}
              isRequired
              className={FIELD_CLASS_NAME}
              name="currency"
              placeholder={CURRENCY_PLACEHOLDER}
              value={currency}
              onChange={(value) => {
                if (typeof value === "string") {
                  setCurrency(value);
                }
              }}
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
          </div>

          <OriginSection
            copy={ORIGIN_SECTION_COPY}
            netAmount={amount}
            netCurrency={currency}
            defaultCurrency={income?.originCurrency ?? null}
            defaultAmount={income?.originAmountDecimal ?? null}
            hasErrors={hasOriginErrors}
          />

          {/* The expense it pays back, when it does. Only offered when the user has an expense in this
              currency that expects money. The choice travels in a hidden input: "No es una devolución"
              sends nothing. */}
          {canReimburse ? (
            <ReimbursesField
              options={choices}
              currency={currency}
              value={reimbursed?.id ?? null}
              onChange={setReimbursesId}
              errorMessage={fieldErrors.reimbursesExpenseId?.[0]}
            />
          ) : null}
          <input
            type="hidden"
            name={REIMBURSES_FIELD}
            value={reimbursed?.id ?? ""}
          />

          <DatePickerField
            isRequired
            name="date"
            label={DATE_LABEL}
            defaultValue={income?.date ?? defaultDate}
          />

          <CategoryField
            categories={categories}
            defaultCategoryId={income?.categoryId ?? null}
            onCreate={createCategoryAction}
          />

          <MediumField
            defaultMedium={income?.medium ?? DEFAULT_PAYMENT_MEDIUM}
          />

          <StatusSwitch
            defaultSettled={income ? income.status === "SETTLED" : true}
            label={STATUS_SWITCH_LABEL}
          />

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={income?.notes ?? ""}
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
          Icon={income ? undefined : PlusIcon}
          label={income ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={income ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
