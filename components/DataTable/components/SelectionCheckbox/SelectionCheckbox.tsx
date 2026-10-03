import { Checkbox } from "@heroui/react";

import type { SelectionCheckboxProps } from "./types";

// The checkbox of the selection column, in a header (select all) or in a row. HeroUI's table wires
// the `selection` slot to the right state, so it ticks, shows the indeterminate dash and locks on
// its own; it has no visible text, so the label is its accessible name. The table would also point
// a row's checkbox at the row header, which reads the name twice ("Seleccionar Ada Ada"), so the
// empty `aria-labelledby` keeps the name to exactly the label.
export function SelectionCheckbox({ label }: SelectionCheckboxProps) {
  return (
    <Checkbox
      slot="selection"
      variant="secondary"
      aria-label={label}
      aria-labelledby=""
    >
      <Checkbox.Content>
        <Checkbox.Control>
          <Checkbox.Indicator />
        </Checkbox.Control>
      </Checkbox.Content>
    </Checkbox>
  );
}
