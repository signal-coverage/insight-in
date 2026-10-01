"use client";

import type { KeyboardEvent } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils/utils";

import { ColumnHeader } from "./components/ColumnHeader";
import { LoadingTable } from "./components/LoadingTable";
import { ScrollFades } from "./components/ScrollFades";
import { DEFAULT_LOADING_ROW_COUNT } from "./consts";
import {
  EDGE_COLUMN_PADDING_CLASSNAME,
  FOOTER_CLASSNAME,
  ROW_INTERACTIVE_CLASSNAME,
  SCROLL_AREA_CLASSNAME,
  SCROLL_BOX_CLASSNAME,
  WRAPPER_CLASSNAME,
} from "./styles";
import type { DataTableProps } from "./types";
import { useScrollFades } from "./useScrollFades";

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  loadingLabel,
  loadingRowCount = DEFAULT_LOADING_ROW_COUNT,
  emptyState,
  className,
  tableClassName,
  onRowClick,
  isRowSelected,
  sort,
  onSortChange,
  footer,
}: DataTableProps<T>) {
  const {
    scrollRef,
    showLeftFade,
    showRightFade,
    scrollbarGutter,
    updateFades,
  } = useScrollFades(columns, rows);

  if (isLoading) {
    return (
      <LoadingTable
        columns={columns}
        rowCount={loadingRowCount}
        label={loadingLabel}
        className={className}
        tableClassName={tableClassName}
      />
    );
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <div className={cn(WRAPPER_CLASSNAME, className)}>
      <div className={SCROLL_BOX_CLASSNAME}>
        <div
          ref={scrollRef}
          onScroll={updateFades}
          className={SCROLL_AREA_CLASSNAME}
        >
          <Table className={cn(EDGE_COLUMN_PADDING_CLASSNAME, tableClassName)}>
            <TableHeader>
              <TableRow>
                {columns.map((column) => (
                  <ColumnHeader
                    key={column.key}
                    column={column}
                    sort={sort}
                    onSortChange={onSortChange}
                  />
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow
                  key={rowKey(row)}
                  data-state={isRowSelected?.(row) ? "selected" : undefined}
                  {...(onRowClick && {
                    role: "button",
                    tabIndex: 0,
                    onClick: () => onRowClick(row),
                    onKeyDown: (event: KeyboardEvent) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      onRowClick(row);
                    },
                    className: ROW_INTERACTIVE_CLASSNAME,
                  })}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className={column.className}>
                      {column.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ScrollFades
          showLeft={showLeftFade}
          showRight={showRightFade}
          gutter={scrollbarGutter}
        />
      </div>

      {footer ? <div className={FOOTER_CLASSNAME}>{footer}</div> : null}
    </div>
  );
}
