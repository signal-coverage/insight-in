import { Skeleton } from "@heroui/react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/utils";

import {
  EDGE_COLUMN_PADDING_CLASSNAME,
  SCROLL_AREA_CLASSNAME,
  WRAPPER_CLASSNAME,
} from "../../styles";
import { DEFAULT_SKELETON_CLASSNAME, STATUS_CLASSNAME } from "./styles";
import type { LoadingTableProps } from "./types";

// The table while its rows are on the way: the real headers over skeleton rows. It is hidden from
// assistive technology (`aria-hidden`); the status above it announces the wait instead.
export function LoadingTable<T>({
  columns,
  rowCount,
  label,
  className,
  tableClassName,
}: LoadingTableProps<T>) {
  return (
    <div className={cn(WRAPPER_CLASSNAME, className)}>
      <span className={STATUS_CLASSNAME} role="status">
        {label}
      </span>
      <div className={SCROLL_AREA_CLASSNAME}>
        <Table
          aria-hidden="true"
          className={cn(EDGE_COLUMN_PADDING_CLASSNAME, tableClassName)}
        >
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead
                  key={column.key}
                  className={cn(column.className, column.headerClassName)}
                >
                  {column.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rowCount }).map((_, index) => (
              <TableRow key={index}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.loadingCell ?? (
                      <Skeleton className={DEFAULT_SKELETON_CLASSNAME} />
                    )}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
