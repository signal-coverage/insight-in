import type { DataTableColumn } from "../../types";

export interface LoadingTableProps<T> {
  // Names the (hidden) table.
  label: string;
  columns: DataTableColumn<T>[];
  // The key of the column that names the row.
  rowHeader: string | null;
  // How many skeleton rows to draw.
  rowCount: number;
  // Announced to assistive technology in place of the (hidden) skeleton.
  loadingLabel: string;
  // Whether the loaded table has a checkbox column, which the skeleton keeps so nothing shifts.
  hasSelection: boolean;
  className?: string;
  tableClassName?: string;
}
