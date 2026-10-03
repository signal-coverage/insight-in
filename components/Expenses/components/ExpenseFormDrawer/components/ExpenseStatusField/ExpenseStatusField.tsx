import { Description, Label, Radio, RadioGroup } from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import {
  COVERED_HINT,
  STATUS_FIELD_NAME,
  STATUS_LABEL,
  STATUS_OPTIONS,
} from "./consts";
import type { ExpenseStatusFieldProps } from "./types";

// The status of an expense: pending, paid, or covered by someone else (counts as done but never
// moves the user's money). A radio group submits the chosen value with the form on its own, so
// there is nothing to wire up.
export function ExpenseStatusField({ defaultStatus }: ExpenseStatusFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={STATUS_FIELD_NAME}
      orientation="horizontal"
      variant="secondary"
      defaultValue={defaultStatus}
    >
      <Label>{STATUS_LABEL}</Label>
      {STATUS_OPTIONS.map(({ value, label }) => (
        <Radio key={value} value={value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
        </Radio>
      ))}
      <Description>{COVERED_HINT}</Description>
    </RadioGroup>
  );
}
