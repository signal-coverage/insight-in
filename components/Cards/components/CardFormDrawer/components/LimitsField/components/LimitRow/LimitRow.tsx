import { TrashIcon } from "@heroicons/react/24/outline";
import {
  Button,
  FieldError,
  Input,
  Label,
  ListBox,
  Select,
  TextField,
} from "@heroui/react";

import { CURRENCY_PLACEHOLDER } from "@/components/Entries/formConsts";
import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { LIMIT_AMOUNT_FIELD, LIMIT_CURRENCY_FIELD } from "@/core/cards/consts";

import {
  LIMIT_AMOUNT_LABEL,
  LIMIT_AMOUNT_PLACEHOLDER,
  LIMIT_CURRENCY_LABEL,
  removeLimitLabel,
} from "../../consts";
import {
  AMOUNT_CLASS_NAME,
  CURRENCY_CLASS_NAME,
  ICON_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { LimitRowProps } from "./types";

// One cap of a credit card: a currency and an amount typed in it. Both submit with the form as one
// more pair of the repeated fields, in the order the rows are shown.
export function LimitRow({
  row,
  currencies,
  canRemove,
  currencyError,
  amountError,
  onChange,
  onRemove,
}: LimitRowProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={CURRENCY_CLASS_NAME}
        name={LIMIT_CURRENCY_FIELD}
        placeholder={CURRENCY_PLACEHOLDER}
        value={row.currency}
        isInvalid={currencyError !== undefined}
        onChange={(key) => {
          if (typeof key === "string") {
            onChange({ currency: key });
          }
        }}
      >
        <Label>{LIMIT_CURRENCY_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {currencies.map(({ code, label }) => (
              <ListBox.Item key={code} id={code} textValue={label}>
                {label}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        {currencyError ? <FieldError>{currencyError}</FieldError> : null}
      </Select>

      <TextField
        isRequired
        className={AMOUNT_CLASS_NAME}
        name={LIMIT_AMOUNT_FIELD}
        inputMode="decimal"
        value={row.amount}
        isInvalid={amountError !== undefined}
        onChange={(amount) => onChange({ amount })}
      >
        <Label>{LIMIT_AMOUNT_LABEL}</Label>
        <Input
          variant={FIELD_VARIANT}
          className={FIELD_HEIGHT_CLASS_NAME}
          placeholder={LIMIT_AMOUNT_PLACEHOLDER}
        />
        {amountError ? <FieldError>{amountError}</FieldError> : null}
      </TextField>

      <Button
        isIconOnly
        size="sm"
        variant="danger-soft"
        aria-label={removeLimitLabel(row.currency)}
        isDisabled={!canRemove}
        onPress={onRemove}
      >
        <TrashIcon className={ICON_CLASS_NAME} aria-hidden="true" />
      </Button>
    </div>
  );
}
