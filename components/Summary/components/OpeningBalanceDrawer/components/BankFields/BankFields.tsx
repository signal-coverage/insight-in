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

import { AMOUNT_HINT, AMOUNT_PLACEHOLDER } from "../../consts";
import type { BankFieldsProps } from "../../types";
import { amountFieldName } from "../../utils";
import { GROUP_CLASS_NAME } from "./styles";

// One bank of the opening balance: what each of its accounts held. The inputs are named by their
// position among all the rows, which is how the server points at the one in error.
export function BankFields({ group }: BankFieldsProps) {
  return (
    <Fieldset>
      <Fieldset.Legend>{group.bankName}</Fieldset.Legend>
      <FieldGroup className={GROUP_CLASS_NAME}>
        {group.rows.map((row) => (
          <TextField
            key={row.accountId}
            className={FIELD_CLASS_NAME}
            name={amountFieldName(row.index)}
            inputMode="decimal"
            defaultValue={row.amount}
          >
            <Label>{row.label}</Label>
            <Input
              variant={FIELD_VARIANT}
              className={FIELD_HEIGHT_CLASS_NAME}
              placeholder={AMOUNT_PLACEHOLDER}
            />
            <FieldError />
          </TextField>
        ))}
      </FieldGroup>
      <Description>{AMOUNT_HINT}</Description>
    </Fieldset>
  );
}
