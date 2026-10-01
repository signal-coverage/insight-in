import { Input, TextField } from "@heroui/react";

import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import { amountAriaLabel } from "./consts";
import {
  CURRENCY_CLASS_NAME,
  FIELD_CLASS_NAME,
  LABEL_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AmountCellProps } from "./types";

// A template still waiting for a choice has an input for this month's amount (the template itself
// never changes) with its currency beside it. A decided one only shows the amount.
export function AmountCell({
  row,
  value,
  isDisabled,
  onChange,
}: AmountCellProps) {
  if (row.decision !== null) {
    return <span className={LABEL_CLASS_NAME}>{row.amountLabel}</span>;
  }

  return (
    <div className={ROOT_CLASS_NAME}>
      <TextField
        aria-label={amountAriaLabel(row.description)}
        className={FIELD_CLASS_NAME}
        inputMode="decimal"
        isDisabled={isDisabled}
        value={value}
        onChange={onChange}
      >
        <Input variant={FIELD_VARIANT} className={FIELD_HEIGHT_CLASS_NAME} />
      </TextField>
      <span className={CURRENCY_CLASS_NAME}>{row.currency}</span>
    </div>
  );
}
