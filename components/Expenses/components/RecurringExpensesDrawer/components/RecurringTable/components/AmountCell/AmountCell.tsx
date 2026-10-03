import { Input, TextField } from "@heroui/react";

import {
  FIELD_HEIGHT_CLASS_NAME,
  FIELD_VARIANT,
} from "@/components/Entries/styles";

import { amountAriaLabel } from "./consts";
import {
  CURRENCY_CLASS_NAME,
  FIELD_CLASS_NAME,
  INPUT_ROW_CLASS_NAME,
  LABEL_CLASS_NAME,
  REFERENCE_CLASS_NAME,
  ROOT_CLASS_NAME,
} from "./styles";
import type { AmountCellProps } from "./types";
import { referenceRate } from "./utils";

// A template still waiting for a choice has an input for its amount (a change is kept on the
// template for the next months) with its currency beside it. When the template remembers a reference
// price, a small line under the input shows it, with the rate the typed amount implies. A decided one
// only shows the amount, which is the one actually used.
export function AmountCell({
  row,
  value,
  isDisabled,
  onChange,
}: AmountCellProps) {
  if (row.decision !== null) {
    return <span className={LABEL_CLASS_NAME}>{row.amountLabel}</span>;
  }

  const rate = referenceRate(row, value);

  return (
    <div className={ROOT_CLASS_NAME}>
      <div className={INPUT_ROW_CLASS_NAME}>
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
      {row.referenceLabel !== null ? (
        <span className={REFERENCE_CLASS_NAME}>{row.referenceLabel}</span>
      ) : null}
      {rate !== null ? (
        <span className={REFERENCE_CLASS_NAME}>{rate}</span>
      ) : null}
    </div>
  );
}
