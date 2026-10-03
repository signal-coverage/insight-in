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
  /** The column that names the row (a description, say): assistive technology reads its cell as the row's title. One per table; the first column when none says so. */
  isRowHeader?: boolean;
  /** Custom loading-state placeholder for this column (e.g. a differently-sized or pill-shaped Skeleton). Falls back to a generic `h-4 w-20` Skeleton when omitted. */
  loadingCell?: ReactNode;
  /** Renders the header as a sort button. Needs `onSortChange` on the table. */
  sortable?: boolean;
  /** Direction applied the first time this column becomes the sorted one. Defaults to "asc". */
  defaultSortDirection?: DataTableSortDirection;
};

// A leading column of checkboxes, one per row, and one in the header that selects the whole page.
export type DataTableSelection<T> = {
  /** The keys (see `rowKey`) of the selected rows. Selection itself is up to the caller. */
  selectedKeys: ReadonlySet<string>;
  /** Called with every selected key after a row, or the header checkbox, is toggled. */
  onSelectionChange: (keys: ReadonlySet<string>) => void;
  /** Accessible name of the header checkbox, which selects every row of the page. */
  selectAllLabel: string;
  /** Accessible name of the checkbox of a row, e.g. "Seleccionar Sueldo". */
  rowLabel: (row: T) => string;
};

export type DataTableProps<T> = {
  /** Names the table for assistive technology (the table's own title is usually the page's). */
  label: string;
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
  /** Adds the checkbox column. Without it the table has no selection at all. */
  selection?: DataTableSelection<T>;
  /** A row that is on its way out (being deleted, say): dimmed, announced as busy and not selectable. Its own buttons are up to the caller. */
  isRowBusy?: (row: T) => boolean;
  /** Announced to assistive technology while any row is busy ("Eliminando…"). The table is marked busy meanwhile. */
  busyLabel?: string;
  /** Something to say about a row, shown in a full-width row right under it (an error, say). Nothing is added for a row that returns null. */
  rowNote?: (row: T) => ReactNode;
  /** The column the rows are currently sorted by (sorting itself is up to the caller). */
  sort?: DataTableSort;
  /** Called with the next sort when a sortable header is clicked. */
  onSortChange?: (sort: DataTableSort) => void;
  /** Rendered below the scrolling area, inside the bordered box, when there are rows. */
  footer?: ReactNode;
};
