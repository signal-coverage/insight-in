import { Skeleton, Table } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import {
  BODY_CLASSNAME,
  EDGE_COLUMN_PADDING_CLASSNAME,
  SCROLL_AREA_CLASSNAME,
  SCROLL_BOX_CLASSNAME,
  SELECTION_SKELETON_CLASSNAME,
  WRAPPER_CLASSNAME,
} from "../../styles";
import { SELECTION_COLUMN_ID } from "../../consts";
import {
  cellClassName,
  selectionCellClassName,
  selectionHeaderClassName,
} from "../../utils";
import { ColumnHeader } from "../ColumnHeader";
import { DEFAULT_SKELETON_CLASSNAME, STATUS_CLASSNAME } from "./styles";
import type { LoadingTableProps } from "./types";
import { loadingRowId } from "./utils";

// The table while its rows are on the way: the real headers over skeleton rows, on the very same
// classes as the loaded table so the columns never move. The table is hidden from assistive
// technology and inert (no tab stop); the status above it announces the wait instead.
export function LoadingTable<T>({
  label,
  columns,
  rowHeader,
  rowCount,
  loadingLabel,
  hasSelection,
  className,
  tableClassName,
}: LoadingTableProps<T>) {
  return (
    <Table variant="secondary" className={cn(WRAPPER_CLASSNAME, className)}>
      <span className={STATUS_CLASSNAME} role="status">
        {loadingLabel}
      </span>
      <div aria-hidden="true" inert className={SCROLL_BOX_CLASSNAME}>
        <Table.ScrollContainer className={SCROLL_AREA_CLASSNAME}>
          <Table.Content
            aria-label={label}
            className={cn(EDGE_COLUMN_PADDING_CLASSNAME, tableClassName)}
          >
            <Table.Header>
              {hasSelection ? (
                <Table.Column
                  id={SELECTION_COLUMN_ID}
                  className={selectionHeaderClassName()}
                >
                  <Skeleton className={SELECTION_SKELETON_CLASSNAME} />
                </Table.Column>
              ) : null}
              {columns.map((column) => (
                <ColumnHeader
                  key={column.key}
                  column={column}
                  isSortable={false}
                  isRowHeader={column.key === rowHeader}
                />
              ))}
            </Table.Header>
            <Table.Body className={BODY_CLASSNAME}>
              {Array.from({ length: rowCount }, (_, index) => (
                <Table.Row key={loadingRowId(index)} id={loadingRowId(index)}>
                  {hasSelection ? (
                    <Table.Cell className={selectionCellClassName()}>
                      <Skeleton className={SELECTION_SKELETON_CLASSNAME} />
                    </Table.Cell>
                  ) : null}
                  {columns.map((column) => (
                    <Table.Cell
                      key={column.key}
                      className={cellClassName(column)}
                    >
                      {column.loadingCell ?? (
                        <Skeleton className={DEFAULT_SKELETON_CLASSNAME} />
                      )}
                    </Table.Cell>
                  ))}
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>
      </div>
    </Table>
  );
}
