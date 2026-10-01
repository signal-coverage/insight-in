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
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import { CategoryField } from "@/components/Entries/components/CategoryField";
import { DatePickerField } from "@/components/Entries/components/DatePickerField";
import { StatusSwitch } from "@/components/Entries/components/StatusSwitch";
import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
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
  DRAWER_DESCRIPTION_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  FORM_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import {
  createCategoryAction,
  createExpenseAction,
  updateExpenseAction,
} from "@/core/expenses/actions";
import type { ExpenseFieldErrors } from "@/core/expenses/types";
import {
  DEFAULT_CURRENCY_CODE,
  DESCRIPTION_MAX_LENGTH,
  NOTES_MAX_LENGTH,
} from "@/core/incomes/consts";

import {
  RECURRING_LOCKED_HINT,
  RECURRING_SWITCH_LABEL,
  STATUS_SWITCH_LABEL,
} from "../../consts";
import { RecurringSwitch } from "./components/RecurringSwitch";
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
import type { ExpenseFormContentProps } from "./types";

// Mounted with a fresh key on every opening, so field defaults and errors always reset.
export function ExpenseFormContent({
  target,
  categories,
  onClose,
}: ExpenseFormContentProps) {
  const { expense, defaultDate } = target;
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<ExpenseFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      const result = expense
        ? await updateExpenseAction(expense.id, formData)
        : await createExpenseAction(formData);

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
          {expense ? EDIT_HEADING : CREATE_HEADING}
        </Drawer.Heading>
        <p className={DRAWER_DESCRIPTION_CLASS_NAME}>
          {expense ? EDIT_DESCRIPTION : CREATE_DESCRIPTION}
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
            defaultValue={expense?.description}
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
              defaultValue={expense?.amountDecimal}
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
              defaultValue={expense?.currency ?? DEFAULT_CURRENCY_CODE}
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

          <DatePickerField
            isRequired
            name="date"
            label={DATE_LABEL}
            defaultValue={expense?.date ?? defaultDate}
          />

          <CategoryField
            categories={categories}
            defaultCategoryId={expense?.categoryId ?? null}
            onCreate={createCategoryAction}
          />

          <StatusSwitch
            defaultSettled={expense ? expense.status === "SETTLED" : true}
            label={STATUS_SWITCH_LABEL}
          />

          {/* An expense is recurring exactly when it belongs to a template: from then on the
              template is managed in the recurring-expenses wizard, not from here. */}
          <RecurringSwitch
            defaultRecurring={expense?.isRecurring ?? false}
            label={RECURRING_SWITCH_LABEL}
            lockedHint={
              expense?.isRecurring ? RECURRING_LOCKED_HINT : undefined
            }
          />

          <TextField
            className={FIELD_CLASS_NAME}
            name="notes"
            maxLength={NOTES_MAX_LENGTH}
            defaultValue={expense?.notes ?? ""}
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
          Icon={expense ? undefined : PlusIcon}
          label={expense ? EDIT_SUBMIT_LABEL : CREATE_SUBMIT_LABEL}
          pendingLabel={expense ? EDIT_PENDING_LABEL : CREATE_PENDING_LABEL}
        />
      </Drawer.Footer>
    </>
  );
}
