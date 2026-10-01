import type {
  DataTableColumn,
  DataTableSort,
  DataTableSortDirection,
} from "../../types";
import type { AriaSort } from "./types";

export const ariaSortFor = (
  column: { key: string },
  sort: DataTableSort | undefined,
): AriaSort => {
  if (sort?.key !== column.key) return "none";

  return sort.direction === "asc" ? "ascending" : "descending";
};

// Clicking a header that is not the sorted one starts at the column's own first direction; clicking
// the sorted one flips it.
export const nextSortDirection = <T>(
  column: DataTableColumn<T>,
  current: AriaSort,
): DataTableSortDirection => {
  if (current === "none") return column.defaultSortDirection ?? "asc";

  return current === "ascending" ? "desc" : "asc";
};
