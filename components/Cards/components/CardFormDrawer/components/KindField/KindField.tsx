import {
  Description,
  FieldError,
  Label,
  Radio,
  RadioGroup,
} from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { KIND_FIELD_NAME, KIND_LABEL, KIND_OPTIONS } from "./consts";
import type { KindFieldProps } from "./types";

// Credit or debit/prepaid, chosen once when the card is added. The form shows only the fields of the
// kind chosen, so the choice is controlled; the radio group also submits it.
export function KindField({ value, onChange }: KindFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={KIND_FIELD_NAME}
      variant="secondary"
      value={value}
      onChange={(next) => {
        const option = KIND_OPTIONS.find(
          (candidate) => candidate.value === next,
        );

        if (option) {
          onChange(option.value);
        }
      }}
    >
      <Label>{KIND_LABEL}</Label>
      {KIND_OPTIONS.map((option) => (
        <Radio key={option.value} value={option.value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {option.label}
          </Radio.Content>
          <Description>{option.hint}</Description>
        </Radio>
      ))}
      <FieldError />
    </RadioGroup>
  );
}
