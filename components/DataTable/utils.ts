import type { Selection, SortDescriptor } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import {
  CELL_CLASSNAME,
  COLUMN_CLASSNAME,
  SELECTION_COLUMN_CLASSNAME,
} from "./styles";
import type {
  DataTableColumn,
  DataTableSort,
  DataTableSortDirection,
} from "./types";

// A header sorts only when the column asks for it and the table can report the new sort.
export const isColumnSortable = <T>(
  column: DataTableColumn<T>,
  onSortChange: ((sort: DataTableSort) => void) | undefined,
): boolean => Boolean(column.sortable && onSortChange);

// HeroUI's table needs exactly one column that names the row: the one that says so, or the first.
export const rowHeaderKey = <T>(columns: DataTableColumn<T>[]): string | null =>
  (columns.find(({ isRowHeader }) => isRowHeader) ?? columns[0])?.key ?? null;

export const toSortDescriptor = (
  sort: DataTableSort | undefined,
): SortDescriptor | undefined =>
  sort
    ? {
        column: sort.key,
        direction: sort.direction === "asc" ? "ascending" : "descending",
      }
    : undefined;

// Clicking a header that is not the sorted one starts at the column's own first direction; clicking
// the sorted one flips it. HeroUI only knows "ascending first", so the direction it proposes is
// ignored and only the column it names is used.
export const nextSort = <T>(
  columns: DataTableColumn<T>[],
  clicked: SortDescriptor,
  current: DataTableSort | undefined,
): DataTableSort | null => {
  const column = columns.find(({ key }) => key === String(clicked.column));

  if (!column) return null;

  const direction: DataTableSortDirection =
    current?.key === column.key
      ? current.direction === "asc"
        ? "desc"
        : "asc"
      : (column.defaultSortDirection ?? "asc");

  return { key: column.key, direction };
};

export const headerClassName = <T>(column: DataTableColumn<T>): string =>
  cn(COLUMN_CLASSNAME, column.className, column.headerClassName);

export const cellClassName = <T>(column: DataTableColumn<T>): string =>
  cn(CELL_CLASSNAME, column.className);

export const selectionHeaderClassName = (): string =>
  cn(COLUMN_CLASSNAME, SELECTION_COLUMN_CLASSNAME);

export const selectionCellClassName = (): string =>
  cn(CELL_CLASSNAME, SELECTION_COLUMN_CLASSNAME);

// HeroUI reports the whole page as "all" when the header checkbox is ticked; the caller only ever
// hears about keys, and only about the ones that can be selected.
export const toKeySet = (
  selection: Selection,
  selectableKeys: readonly string[],
): ReadonlySet<string> =>
  selection === "all"
    ? new Set(selectableKeys)
    : new Set(Array.from(selection, String));

// HeroUI's rows only react to presses once they declare an action. `onAction` answers click and
// Enter but not Space, so the row's real handler is `onPress` (all three) and this stands in for
// the action.
export const doNothing = (): void => {};

export const noteRowId = (rowId: string): string => `${rowId}:note`;
