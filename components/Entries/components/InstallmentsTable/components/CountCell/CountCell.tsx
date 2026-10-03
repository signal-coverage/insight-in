import { NumberField } from "@heroui/react";

import { countAriaLabel, MIN_COUNT } from "./consts";
import { FIELD_CLASS_NAME, GROUP_CLASS_NAME, INPUT_CLASS_NAME } from "./styles";
import type { CountCellProps } from "./types";

// How many installments of a purchase the user pays this month: from none (the plan moves back a
// month) up to everything that is still pending.
export function CountCell({
  row,
  value,
  isDisabled,
  onChange,
}: CountCellProps) {
  return (
    <NumberField
      aria-label={countAriaLabel(row.description)}
      className={FIELD_CLASS_NAME}
      variant="secondary"
      minValue={MIN_COUNT}
      maxValue={row.pendingCount}
      value={value}
      isDisabled={isDisabled}
      onChange={(next) => {
        // An emptied field has no number yet: it keeps the last one until something valid is typed.
        if (next !== undefined && !Number.isNaN(next)) {
          onChange(next);
        }
      }}
    >
      <NumberField.Group className={GROUP_CLASS_NAME}>
        <NumberField.DecrementButton />
        <NumberField.Input className={INPUT_CLASS_NAME} />
        <NumberField.IncrementButton />
      </NumberField.Group>
    </NumberField>
  );
}
