import { FieldError, Label, ListBox, Select } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";

import {
  CARD_LABEL,
  CARD_PLACEHOLDER,
  NO_CARD_KEY,
  NO_CARD_LABEL,
} from "./consts";
import type { CardFieldProps } from "./types";

// The card a purchase is paid with. By default it is optional: "Sin tarjeta" is the default and a
// real option. With `isRequired` there is no such option and the user has to pick a card. Only the
// cards in the currency of the purchase are listed. It does not submit anything on its own: the form
// that uses it sends the choice.
export function CardField({
  cards,
  currency,
  value,
  onChange,
  errorMessage,
  isRequired = false,
}: CardFieldProps) {
  const options = cards.filter((card) => card.currency === currency);

  return (
    <Select
      variant={FIELD_VARIANT}
      className={FIELD_CLASS_NAME}
      isRequired={isRequired}
      placeholder={CARD_PLACEHOLDER}
      value={value ?? (isRequired ? null : NO_CARD_KEY)}
      isInvalid={errorMessage !== undefined}
      onChange={(key) =>
        onChange(typeof key === "string" && key !== NO_CARD_KEY ? key : null)
      }
    >
      <Label>{CARD_LABEL}</Label>
      <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover>
        <ListBox>
          {isRequired ? null : (
            <ListBox.Item id={NO_CARD_KEY} textValue={NO_CARD_LABEL}>
              {NO_CARD_LABEL}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          )}
          {options.map(({ id, title }) => (
            <ListBox.Item key={id} id={id} textValue={title}>
              {title}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
      {errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
    </Select>
  );
}
