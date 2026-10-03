import { ChevronUpDownIcon } from "@heroicons/react/24/outline";
import { Table } from "@heroui/react";

import { headerClassName } from "../../utils";
import { SORT_HEADER_CLASSNAME, UNSORTED_ICON_CLASSNAME } from "./styles";
import type { ColumnHeaderProps } from "./types";

// One header cell: plain text, or a sortable HeroUI column (aria-sort, press to sort) when the
// column is sortable and the table can sort.
export function ColumnHeader<T>({
  column,
  isSortable,
  isRowHeader,
}: ColumnHeaderProps<T>) {
  return (
    <Table.Column
      id={column.key}
      isRowHeader={isRowHeader}
      allowsSorting={isSortable}
      className={headerClassName(column)}
    >
      {isSortable
        ? ({ sortDirection }) => (
            <Table.SortableColumnHeader
              sortDirection={sortDirection}
              className={SORT_HEADER_CLASSNAME}
            >
              {column.header}
              {sortDirection ? null : (
                <ChevronUpDownIcon
                  className={UNSORTED_ICON_CLASSNAME}
                  aria-hidden="true"
                />
              )}
            </Table.SortableColumnHeader>
          )
        : column.header}
    </Table.Column>
  );
}
