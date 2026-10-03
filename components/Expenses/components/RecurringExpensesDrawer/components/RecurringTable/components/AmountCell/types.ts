import type { RecurringRow } from "../../../../../../types";

export interface AmountCellProps {
  row: RecurringRow;
  // What the input shows: the template amount until the user edits it.
  value: string;
  isDisabled: boolean;
  onChange: (value: string) => void;
}
