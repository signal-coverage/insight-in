import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils/utils";

import { SortIcon } from "./components/SortIcon";
import { SORT_BUTTON_CLASSNAME } from "./styles";
import type { ColumnHeaderProps } from "./types";
import { ariaSortFor, nextSortDirection } from "./utils";

// One header cell: plain text, or a sort button when the column is sortable and the table can sort.
export function ColumnHeader<T>({
  column,
  sort,
  onSortChange,
}: ColumnHeaderProps<T>) {
  const className = cn(column.className, column.headerClassName);

  if (!column.sortable || !onSortChange) {
    return <TableHead className={className}>{column.header}</TableHead>;
  }

  const ariaSort = ariaSortFor(column, sort);

  return (
    <TableHead className={className} aria-sort={ariaSort}>
      <button
        type="button"
        className={SORT_BUTTON_CLASSNAME}
        onClick={() =>
          onSortChange({
            key: column.key,
            direction: nextSortDirection(column, ariaSort),
          })
        }
      >
        {column.header}
        <SortIcon direction={ariaSort} />
      </button>
    </TableHead>
  );
}
