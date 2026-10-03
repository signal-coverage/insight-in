import { Description, FieldError, Label, NumberField } from "@heroui/react";

import { FIELD_CLASS_NAME, FIELD_VARIANT } from "@/components/Entries/styles";
import { MAX_CARD_DAY, MIN_CARD_DAY } from "@/core/cards/consts";

import { GROUP_CLASS_NAME, INPUT_CLASS_NAME } from "./styles";
import type { DayFieldProps } from "./types";

// A day of the month, 1 to 31. A month too short for it uses its last day, which the server applies.
export function DayField({
  name,
  label,
  hint,
  value,
  onChange,
}: DayFieldProps) {
  return (
    <NumberField
      isRequired
      className={FIELD_CLASS_NAME}
      variant={FIELD_VARIANT}
      name={name}
      minValue={MIN_CARD_DAY}
      maxValue={MAX_CARD_DAY}
      value={value}
      onChange={onChange}
    >
      <Label>{label}</Label>
      <NumberField.Group className={GROUP_CLASS_NAME}>
        <NumberField.DecrementButton />
        <NumberField.Input className={INPUT_CLASS_NAME} />
        <NumberField.IncrementButton />
      </NumberField.Group>
      <Description>{hint}</Description>
      <FieldError />
    </NumberField>
  );
}
