import { Radio, RadioGroup } from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { AMOUNT_MODE_LABEL, AMOUNT_MODE_OPTIONS } from "./consts";
import type { AmountModeFieldProps } from "./types";

// Whether the single amount of a plan in installments is the whole thing or one installment.
export function AmountModeField({ value, onChange }: AmountModeFieldProps) {
  return (
    <RadioGroup
      aria-label={AMOUNT_MODE_LABEL}
      className={FIELD_CLASS_NAME}
      orientation="horizontal"
      variant="secondary"
      value={value}
      onChange={(next) => {
        const option = AMOUNT_MODE_OPTIONS.find(
          (candidate) => candidate.value === next,
        );

        if (option) {
          onChange(option.value);
        }
      }}
    >
      {AMOUNT_MODE_OPTIONS.map(({ value: optionValue, label }) => (
        <Radio key={optionValue} value={optionValue}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
        </Radio>
      ))}
    </RadioGroup>
  );
}
