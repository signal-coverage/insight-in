import { FieldError, Input, Label, TextField } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import {
  LAST4_FIELD_NAME,
  LAST4_LABEL,
  LAST4_LENGTH,
  LAST4_PLACEHOLDER,
} from "./consts";
import type { Last4FieldProps } from "./types";
import { digitsOnly } from "./utils";

// The last four digits of the card, the only part of its number the app keeps. Only digits can be
// typed. The form owns the value, so the card preview can follow it.
export function Last4Field({ value, onChange }: Last4FieldProps) {
  return (
    <TextField
      isRequired
      className={FIELD_CLASS_NAME}
      name={LAST4_FIELD_NAME}
      inputMode="numeric"
      maxLength={LAST4_LENGTH}
      value={value}
      onChange={(next) => onChange(digitsOnly(next, LAST4_LENGTH))}
    >
      <Label>{LAST4_LABEL}</Label>
      <Input
        variant={FIELD_VARIANT}
        className={FIELD_HEIGHT_CLASS_NAME}
        placeholder={LAST4_PLACEHOLDER}
        autoComplete="off"
      />
      <FieldError />
    </TextField>
  );
}
