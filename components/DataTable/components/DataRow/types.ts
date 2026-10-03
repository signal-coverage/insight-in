import type { DataTableColumn } from "../../types";

export interface DataRowProps<T> {
  // The row's key, which is also the key of its HeroUI row.
  id: string;
  row: T;
  columns: DataTableColumn<T>[];
  isSelected: boolean;
  // Makes the whole row pressable (click, Enter or Space).
  onPress?: (row: T) => void;
  // The accessible name of the row's checkbox. Set only when the table has a checkbox column.
  selectionLabel?: string;
  // The row is on its way out: dimmed and announced as busy.
  isBusy?: boolean;
}
