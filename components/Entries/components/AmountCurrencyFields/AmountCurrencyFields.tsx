import {
  Description,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";

import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  AMOUNT_PLACEHOLDER,
  CURRENCY_LABEL,
  CURRENCY_PLACEHOLDER,
} from "@/components/Entries/formConsts";
import {
  AMOUNT_ROW_CLASS_NAME,
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import type { AmountCurrencyFieldsProps } from "./types";

// The amount and its currency side by side, controlled by the parent (the planners keep their data
// in local state while the user moves between steps).
export function AmountCurrencyFields({
  amount,
  currency,
  onChange,
}: AmountCurrencyFieldsProps) {
  return (
    <div className={AMOUNT_ROW_CLASS_NAME}>
      <TextField
        isRequired
        className={FIELD_CLASS_NAME}
        inputMode="decimal"
        value={amount}
        onChange={(next) => onChange({ amount: next })}
      >
        <Label>{AMOUNT_LABEL}</Label>
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={AMOUNT_PLACEHOLDER}
        />
        <Description>{AMOUNT_HINT}</Description>
      </TextField>

      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={FIELD_CLASS_NAME}
        placeholder={CURRENCY_PLACEHOLDER}
        value={currency}
        onChange={(value) => {
          if (typeof value === "string") {
            onChange({ currency: value });
          }
        }}
      >
        <Label>{CURRENCY_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {CURRENCY_OPTIONS.map(({ code, label }) => (
              <ListBox.Item key={code} id={code} textValue={label}>
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
      </Select>
    </div>
  );
}
