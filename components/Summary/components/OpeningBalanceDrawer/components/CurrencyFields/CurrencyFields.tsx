import {
  Description,
  FieldError,
  FieldGroup,
  Fieldset,
  Input,
  Label,
  TextField,
} from "@heroui/react";

import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import {
  AMOUNT_HINT,
  AMOUNT_PLACEHOLDER,
  CASH_LABEL,
  DIGITAL_LABEL,
} from "../../consts";
import { amountFieldName } from "../../utils";
import { GROUP_CLASS_NAME } from "./styles";
import type { CurrencyFieldsProps } from "../../types";

// One currency of the opening balance: what was held in accounts and what was held in cash.
// The inputs are named by their position, which is how the server points at the one in error.
export function CurrencyFields({ row, index }: CurrencyFieldsProps) {
  return (
    <Fieldset>
      <Fieldset.Legend>{row.currency}</Fieldset.Legend>
      <FieldGroup className={GROUP_CLASS_NAME}>
        <TextField
          className={FIELD_CLASS_NAME}
          name={amountFieldName(index, "digital")}
          inputMode="decimal"
          defaultValue={row.digital}
        >
          <Label>{DIGITAL_LABEL}</Label>
          <Input
            variant={FIELD_VARIANT}
            className={FIELD_HEIGHT_CLASS_NAME}
            placeholder={AMOUNT_PLACEHOLDER}
          />
          <FieldError />
        </TextField>

        <TextField
          className={FIELD_CLASS_NAME}
          name={amountFieldName(index, "cash")}
          inputMode="decimal"
          defaultValue={row.cash}
        >
          <Label>{CASH_LABEL}</Label>
          <Input
            variant={FIELD_VARIANT}
            className={FIELD_HEIGHT_CLASS_NAME}
            placeholder={AMOUNT_PLACEHOLDER}
          />
          <FieldError />
        </TextField>
      </FieldGroup>
      <Description>{AMOUNT_HINT}</Description>
    </Fieldset>
  );
}
