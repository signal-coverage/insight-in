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

// A bank entity or a virtual wallet. Nothing else in the form depends on it, so it is uncontrolled;
// the server's refusal to make a wallet with crypto accounts an entity shows under it.
export function KindField({ defaultValue }: KindFieldProps) {
  return (
    <RadioGroup
      className={FIELD_CLASS_NAME}
      name={KIND_FIELD_NAME}
      variant="secondary"
      defaultValue={defaultValue}
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
