import type { ReactNode } from "react";

import type { DataTableSort } from "@/components/DataTable";

import type { ExpenseRow } from "../../types";

export interface ExpensesTableProps {
  rows: ExpenseRow[];
  // True while the rows are still on their way (first load or a filter, sort or page change):
  // the table shows skeleton rows instead.
  isLoading?: boolean;
  // True when expenses exist but none show, so an empty result reads "no matches" instead of
  // "no expenses".
  isFiltered: boolean;
  sort: DataTableSort;
  onSortChange: (sort: DataTableSort) => void;
  footer?: ReactNode;
  onAdd: () => void;
  // Absent when the view is already at its defaults: there is nothing to clear.
  onClearFilters?: () => void;
  onEdit: (expense: ExpenseRow) => void;
  onDelete: (expense: ExpenseRow) => void;
  // The checkbox of a row: `isSettled` is the state it asks for.
  onToggleStatus: (expense: ExpenseRow, isSettled: boolean) => void;
}
