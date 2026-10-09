import {
  Button,
  Drawer,
  FieldError,
  Form,
  Label,
  ListBox,
  Select,
} from "@heroui/react";
import { useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  FIELD_CLASS_NAME,
  SELECT_TRIGGER_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";
import { InlineAlert } from "@/components/shared/InlineAlert";
import { PendingButton } from "@/components/shared/PendingButton";
import { saveOpeningBalanceAction } from "@/core/balances/actions";

import { BankFields } from "./components/BankFields";
import {
  CANCEL_LABEL,
  DESCRIPTION,
  FORM_ID,
  HEADING,
  MONTH_FIELD_NAME,
  MONTH_LABEL,
  MONTH_PLACEHOLDER,
  PENDING_LABEL,
  SUBMIT_LABEL,
} from "./consts";
import { DESCRIPTION_CLASS_NAME, FORM_CLASS_NAME } from "./styles";
import type { OpeningBalanceContentProps } from "./types";
import { monthOptions, toPayload } from "./utils";

// Mounted with a fresh key on every opening, so the fields start from what is saved and the
// errors reset.
export function OpeningBalanceContent({
  currentMonth,
  data,
  onClose,
}: OpeningBalanceContentProps) {
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const payload = toPayload(new FormData(event.currentTarget), data.groups);

    startTransition(async () => {
      const result = await saveOpeningBalanceAction(payload);

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
        <p className={DESCRIPTION_CLASS_NAME}>{DESCRIPTION}</p>
      </Drawer.Header>
      <Drawer.Body>
        <Form
          id={FORM_ID}
          className={FORM_CLASS_NAME}
          validationErrors={fieldErrors}
          onSubmit={handleSubmit}
        >
          <Select
            isRequired
            variant={FIELD_VARIANT}
            className={FIELD_CLASS_NAME}
            name={MONTH_FIELD_NAME}
            placeholder={MONTH_PLACEHOLDER}
            defaultValue={data.month ?? currentMonth}
          >
            <Label>{MONTH_LABEL}</Label>
            <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                {monthOptions(currentMonth, data.month).map(
                  ({ value, label }) => (
                    <ListBox.Item key={value} id={value} textValue={label}>
                      {label}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ),
                )}
              </ListBox>
            </Select.Popover>
            <FieldError />
          </Select>

          {data.groups.map((group) => (
            <BankFields key={group.bankId} group={group} />
          ))}

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
