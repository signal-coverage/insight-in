import type { ReactNode } from "react";

import type { DataTableSort } from "@/components/DataTable";

import type { IncomeRow } from "../../types";

export interface IncomesTableProps {
  rows: IncomeRow[];
  // True while the rows are still on their way (first load or a filter, sort or page change):
  // the table shows skeleton rows instead.
  isLoading?: boolean;
  // True when incomes exist but none show, so an empty result reads "no matches" instead of
  // "no incomes".
  isFiltered: boolean;
  sort: DataTableSort;
  onSortChange: (sort: DataTableSort) => void;
  footer?: ReactNode;
  onAdd: () => void;
  // Absent when the view is already at its defaults: there is nothing to clear.
  onClearFilters?: () => void;
  onEdit: (income: IncomeRow) => void;
  onDelete: (income: IncomeRow) => void;
  // The checkbox of a row: `isSettled` is the state it asks for.
  onToggleStatus: (income: IncomeRow, isSettled: boolean) => void;
}
