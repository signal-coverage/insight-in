import { FieldError, Label, Link, ListBox, Select } from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_VARIANT,
  SELECT_TRIGGER_CLASS_NAME,
} from "@/components/Entries/styles";
import { BANKS_PATH } from "@/core/banks/consts";

import {
  BANK_FIELD_NAME,
  BANK_LABEL,
  BANK_PLACEHOLDER,
  CREATE_BANK_LINK_LABEL,
  NO_BANKS_HINT,
} from "./consts";
import { HINT_CLASS_NAME, ROOT_CLASS_NAME } from "./styles";
import type { BankFieldProps } from "./types";

// The bank of a new card, among the user's active banks; the only one is preselected. With none, the
// field is disabled and a line links to Bancos. The line sits outside the select: HeroUI hides the
// description slot of an invalid select.
export function BankField({ banks }: BankFieldProps) {
  return (
    <div className={ROOT_CLASS_NAME}>
      <Select
        isRequired
        variant={FIELD_VARIANT}
        className={FIELD_CLASS_NAME}
        name={BANK_FIELD_NAME}
        placeholder={BANK_PLACEHOLDER}
        defaultValue={banks.length === 1 ? banks[0].id : undefined}
        isDisabled={banks.length === 0}
      >
        <Label>{BANK_LABEL}</Label>
        <Select.Trigger className={SELECT_TRIGGER_CLASS_NAME}>
          <Select.Value />
          <Select.Indicator />
        </Select.Trigger>
        <Select.Popover>
          <ListBox>
            {banks.map(({ id, name }) => (
              <ListBox.Item key={id} id={id} textValue={name}>
                {name}
                <ListBox.ItemIndicator />
              </ListBox.Item>
            ))}
          </ListBox>
        </Select.Popover>
        <FieldError />
      </Select>
      {banks.length === 0 ? (
        <p className={HINT_CLASS_NAME}>
          {NO_BANKS_HINT}{" "}
          <Link href={BANKS_PATH}>{CREATE_BANK_LINK_LABEL}</Link>
        </p>
      ) : null}
    </div>
  );
}
