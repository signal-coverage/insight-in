import { FieldError, Label, Radio, RadioGroup } from "@heroui/react";

import { FIELD_CLASS_NAME } from "@/components/Entries/styles";

import { BRAND_FIELD_NAME, BRAND_LABEL, BRAND_OPTIONS } from "./consts";
import type { BrandFieldProps } from "./types";
import { toBrand } from "./utils";

// The brand of the card. A radio group submits the chosen value with the form on its own.
export function BrandField({ value, onChange }: BrandFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={BRAND_FIELD_NAME}
      orientation="horizontal"
      variant="secondary"
      value={value}
      onChange={(next) => {
        const brand = toBrand(next);

        if (brand) onChange(brand);
      }}
    >
      <Label>{BRAND_LABEL}</Label>
      {BRAND_OPTIONS.map(({ value, label }) => (
        <Radio key={value} value={value}>
          <Radio.Content>
            <Radio.Control>
              <Radio.Indicator />
            </Radio.Control>
            {label}
          </Radio.Content>
        </Radio>
      ))}
      <FieldError />
    </RadioGroup>
  );
}
