import type { DataTableColumn } from "../../types";

export interface ColumnHeaderProps<T> {
  column: DataTableColumn<T>;
  // Whether the header sorts: the column asked for it and the table can report the new sort.
  isSortable: boolean;
  // Whether this column names the row (HeroUI's table needs one).
  isRowHeader: boolean;
}
