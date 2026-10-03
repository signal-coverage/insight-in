import {
  Description,
  FieldError,
  Input,
  Label,
  TextField,
} from "@heroui/react";

import { AMOUNT_PLACEHOLDER } from "@/components/Entries/formConsts";
import {
  FIELD_CLASS_NAME,
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import {
  EXPECTED_REIMBURSEMENT_FIELD,
  EXPECTED_REIMBURSEMENT_HINT,
  EXPECTED_REIMBURSEMENT_LABEL,
} from "./consts";
import type { ExpectedReimbursementFieldProps } from "./types";

// What the user expects to be paid back for the expense (a health-insurance refund, a loan to a
// friend), in the currency of the expense. Optional: empty means nothing is expected, and emptying it
// while editing clears it.
export function ExpectedReimbursementField({
  defaultValue,
}: ExpectedReimbursementFieldProps) {
  return (
    <TextField
      className={FIELD_CLASS_NAME}
      name={EXPECTED_REIMBURSEMENT_FIELD}
      inputMode="decimal"
      defaultValue={defaultValue ?? ""}
    >
      <Label>{EXPECTED_REIMBURSEMENT_LABEL}</Label>
      <Input
        variant={FIELD_VARIANT}
        className={FIELD_HEIGHT_CLASS_NAME}
        placeholder={AMOUNT_PLACEHOLDER}
      />
      <Description>{EXPECTED_REIMBURSEMENT_HINT}</Description>
      <FieldError />
    </TextField>
  );
}
