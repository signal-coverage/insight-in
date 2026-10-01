import type { DataTableColumn, DataTableSort } from "../../types";

// The `aria-sort` values a column header can carry.
export type AriaSort = "ascending" | "descending" | "none";

export interface ColumnHeaderProps<T> {
  column: DataTableColumn<T>;
  // The column the rows are sorted by right now, if any.
  sort?: DataTableSort;
  // Without it no header is a sort button, whatever the column says.
  onSortChange?: (sort: DataTableSort) => void;
}
