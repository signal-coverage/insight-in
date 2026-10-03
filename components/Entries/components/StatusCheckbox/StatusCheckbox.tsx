import { Checkbox } from "@heroui/react";

import { ROOT_CLASS_NAME } from "./consts";
import type { StatusCheckboxProps } from "./types";

// The first cell of every row: ticked once the entry has been collected or paid. It has no
// visible text, so the row's description goes into the accessible name.
export function StatusCheckbox({
  isSettled,
  label,
  isDisabled,
  onChange,
}: StatusCheckboxProps) {
  return (
    <Checkbox
      className={ROOT_CLASS_NAME}
      aria-label={label}
      isSelected={isSettled}
      isDisabled={isDisabled}
      onChange={onChange}
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
