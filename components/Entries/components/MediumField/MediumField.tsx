import { Label, Radio, RadioGroup } from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { MEDIUM_FIELD_NAME, MEDIUM_LABEL, MEDIUM_OPTIONS } from "./consts";
import type { MediumFieldProps } from "./types";

// "Medio" of an entry: whether the money moved through an account or as cash. A radio group
// submits the chosen value with the form on its own, so there is nothing to wire up.
export function MediumField({ defaultMedium, onChange }: MediumFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={MEDIUM_FIELD_NAME}
      orientation="horizontal"
      variant="secondary"
      defaultValue={defaultMedium}
      onChange={(value) => {
        const option = MEDIUM_OPTIONS.find(
          (candidate) => candidate.value === value,
        );

        if (option) {
          onChange?.(option.value);
        }
      }}
    >
      <Label>{MEDIUM_LABEL}</Label>
      {MEDIUM_OPTIONS.map(({ value, label }) => (
        <Radio key={value} value={value}>
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
