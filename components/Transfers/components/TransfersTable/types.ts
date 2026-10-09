import type { TransferRow } from "../../types";

export interface TransfersTableProps {
  rows: TransferRow[];
  // True while the rows are still on their way (first load or another month): skeleton rows instead.
  isLoading?: boolean;
  // True when filters are on, so an empty result reads "no matches" instead of "no transfers".
  isFiltered: boolean;
  onAdd: () => void;
  // Absent when the filters are already at their defaults: there is nothing to clear.
  onClearFilters?: () => void;
  onEdit: (transfer: TransferRow) => void;
  onDelete: (transfer: TransferRow) => void;
  // The ids of the selected rows. The checkbox column is there once `onSelectionChange` is.
  selectedIds?: ReadonlySet<string>;
  onSelectionChange?: (ids: ReadonlySet<string>) => void;
  // The ids of the rows a delete is working on: dimmed, not selectable and with every control locked
  // until the refreshed rows arrive.
  deletingIds?: ReadonlySet<string>;
}
