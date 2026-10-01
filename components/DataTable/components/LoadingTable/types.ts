import type { DataTableColumn } from "../../types";

export interface LoadingTableProps<T> {
  columns: DataTableColumn<T>[];
  // How many skeleton rows to draw.
  rowCount: number;
  // Announced to assistive technology in place of the (hidden) skeleton.
  label: string;
  className?: string;
  tableClassName?: string;
}
