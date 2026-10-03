import {
  Description,
  FieldError,
  Label,
  Radio,
  RadioGroup,
} from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import {
  LIMIT_MODE_FIELD_NAME,
  LIMIT_MODE_LABEL,
  LIMIT_MODE_OPTIONS,
} from "./consts";
import type { LimitModeFieldProps } from "./types";

// The kind of cap of the card: what the user wants to pay in a month, or what they want to have
// committed in installments. Each option says what it means. A radio group submits the chosen
// value with the form on its own.
export function LimitModeField({ defaultMode }: LimitModeFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={LIMIT_MODE_FIELD_NAME}
      variant="secondary"
      defaultValue={defaultMode}
    >
      <Label>{LIMIT_MODE_LABEL}</Label>
      {LIMIT_MODE_OPTIONS.map(({ value, label, hint }) => (
        <Radio key={value} value={value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
          <Description>{hint}</Description>
        </Radio>
      ))}
      <FieldError />
    </RadioGroup>
  );
}
