import { FieldError, Label, ListBox, Select } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import {
  NO_REIMBURSEMENT_KEY,
  NO_REIMBURSEMENT_LABEL,
  REIMBURSES_LABEL,
  REIMBURSES_PLACEHOLDER,
} from "./consts";
import type { ReimbursesFieldProps } from "./types";

// The expense an income pays back, when it does: "Es devolución de un gasto". It is optional, and
// "No es una devolución" is the default and a real option. Only the expenses in the currency of the
// income are listed. It does not submit anything on its own: the form that uses it sends the choice.
export function ReimbursesField({
  options,
  currency,
  value,
  onChange,
  errorMessage,
}: ReimbursesFieldProps) {
  const listed = options.filter((option) => option.currency === currency);

  return (
    <Select
      variant={FIELD_VARIANT}
      className={FIELD_CLASS_NAME}
      placeholder={REIMBURSES_PLACEHOLDER}
      value={value ?? NO_REIMBURSEMENT_KEY}
      isInvalid={errorMessage !== undefined}
      onChange={(key) =>
        onChange(
          typeof key === "string" && key !== NO_REIMBURSEMENT_KEY ? key : null,
        )
      }
    >
      <Label>{REIMBURSES_LABEL}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          <ListBox.Item
            id={NO_REIMBURSEMENT_KEY}
            textValue={NO_REIMBURSEMENT_LABEL}
          >
            {NO_REIMBURSEMENT_LABEL}
            <ListBox.ItemIndicator />
          </ListBox.Item>
          {listed.map(({ id, label }) => (
            <ListBox.Item key={id} id={id} textValue={label}>
              {label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </Select>
  );
}
