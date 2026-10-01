import type { ReactNode } from "react";

export type DataTableSortDirection = "asc" | "desc";

export type DataTableSort = {
  key: string;
  direction: DataTableSortDirection;
};

export type DataTableColumn<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
  /** Custom loading-state placeholder for this column (e.g. a differently-sized or pill-shaped Skeleton). Falls back to a generic `h-4 w-20` Skeleton when omitted. */
  loadingCell?: ReactNode;
  /** Renders the header as a sort button. Needs `onSortChange` on the table. */
  sortable?: boolean;
  /** Direction applied the first time this column becomes the sorted one. Defaults to "asc". */
  defaultSortDirection?: DataTableSortDirection;
};

export type DataTableProps<T> = {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading: boolean;
  loadingLabel: string;
  loadingRowCount?: number;
  emptyState: ReactNode;
  className?: string;
  /** Classes for the <table> itself, used by the loading table and the loaded one alike. With `table-fixed` the columns take their width from their own classes instead of from their content, so the skeleton and the data line up. */
  tableClassName?: string;
  onRowClick?: (row: T) => void;
  isRowSelected?: (row: T) => boolean;
  /** The column the rows are currently sorted by (sorting itself is up to the caller). */
  sort?: DataTableSort;
  /** Called with the next sort when a sortable header is clicked. */
  onSortChange?: (sort: DataTableSort) => void;
  /** Rendered below the scrolling area, inside the bordered box, when there are rows. */
  footer?: ReactNode;
};
