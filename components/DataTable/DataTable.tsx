"use client";

import { Table } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import { ColumnHeader } from "./components/ColumnHeader";
import { DataRow } from "./components/DataRow";
import { LoadingTable } from "./components/LoadingTable";
import { NoteRow } from "./components/NoteRow";
import { ScrollFades } from "./components/ScrollFades";
import { SelectionCheckbox } from "./components/SelectionCheckbox";
import { DEFAULT_LOADING_ROW_COUNT, SELECTION_COLUMN_ID } from "./consts";
import {
  BODY_CLASSNAME,
  BUSY_STATUS_CLASSNAME,
  EDGE_COLUMN_PADDING_CLASSNAME,
  FOOTER_CLASSNAME,
  SCROLL_AREA_CLASSNAME,
  SCROLL_BOX_CLASSNAME,
  WRAPPER_CLASSNAME,
} from "./styles";
import type { DataTableProps } from "./types";
import { useScrollFades } from "./useScrollFades";
import {
  isColumnSortable,
  nextSort,
  noteRowId,
  rowHeaderKey,
  selectionHeaderClassName,
  toKeySet,
  toSortDescriptor,
} from "./utils";

export function DataTable<T>({
  label,
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
  selection,
  isRowBusy,
  busyLabel,
  rowNote,
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

  const rowHeader = rowHeaderKey(columns);

  if (isLoading) {
    return (
      <LoadingTable
        label={label}
        columns={columns}
        rowHeader={rowHeader}
        rowCount={loadingRowCount}
        loadingLabel={loadingLabel}
        hasSelection={Boolean(selection)}
        className={className}
        tableClassName={tableClassName}
      />
    );
  }

  if (rows.length === 0) {
    return <>{emptyState}</>;
  }

  const entries = rows.map((row) => {
    const id = rowKey(row);

    return { row, id, note: rowNote?.(row), isBusy: Boolean(isRowBusy?.(row)) };
  });
  // A row on its way out cannot be selected, and a note is never something to select, so the table
  // keeps both out of the selection (and out of "select the whole page").
  const selectableKeys = entries
    .filter(({ isBusy }) => !isBusy)
    .map(({ id }) => id);
  const disabledKeys = entries.flatMap(({ id, note, isBusy }) => [
    ...(isBusy ? [id] : []),
    ...(note ? [noteRowId(id)] : []),
  ]);

  const hasBusyRow = entries.some(({ isBusy }) => isBusy);

  return (
    <Table
      variant="secondary"
      className={cn(WRAPPER_CLASSNAME, className)}
      aria-busy={hasBusyRow ? true : undefined}
    >
      {busyLabel ? (
        <span className={BUSY_STATUS_CLASSNAME} aria-live="polite">
          {hasBusyRow ? busyLabel : null}
        </span>
      ) : null}
      <div className={SCROLL_BOX_CLASSNAME}>
        <Table.ScrollContainer
          ref={scrollRef}
          onScroll={updateFades}
          className={SCROLL_AREA_CLASSNAME}
        >
          <Table.Content
            aria-label={label}
            className={cn(EDGE_COLUMN_PADDING_CLASSNAME, tableClassName)}
            sortDescriptor={toSortDescriptor(sort)}
            onSortChange={(clicked) => {
              const next = nextSort(columns, clicked, sort);

              if (next) onSortChange?.(next);
            }}
            selectionMode={selection ? "multiple" : undefined}
            selectedKeys={selection?.selectedKeys}
            onSelectionChange={(keys) =>
              selection?.onSelectionChange(toKeySet(keys, selectableKeys))
            }
            disabledKeys={disabledKeys}
          >
            <Table.Header>
              {selection ? (
                <Table.Column
                  id={SELECTION_COLUMN_ID}
                  className={selectionHeaderClassName()}
                >
                  <SelectionCheckbox label={selection.selectAllLabel} />
                </Table.Column>
              ) : null}
              {columns.map((column) => (
                <ColumnHeader
                  key={column.key}
                  column={column}
                  isSortable={isColumnSortable(column, onSortChange)}
                  isRowHeader={column.key === rowHeader}
                />
              ))}
            </Table.Header>
            <Table.Body className={BODY_CLASSNAME}>
              {entries.flatMap(({ row, id, note, isBusy }) => [
                <DataRow
                  key={id}
                  id={id}
                  row={row}
                  columns={columns}
                  isSelected={
                    Boolean(isRowSelected?.(row)) ||
                    Boolean(selection?.selectedKeys.has(id))
                  }
                  onPress={onRowClick}
                  selectionLabel={selection?.rowLabel(row)}
                  isBusy={isBusy}
                />,
                ...(note
                  ? [
                      <NoteRow
                        key={noteRowId(id)}
                        id={noteRowId(id)}
                        columnCount={columns.length + (selection ? 1 : 0)}
                      >
                        {note}
                      </NoteRow>,
                    ]
                  : []),
              ])}
            </Table.Body>
          </Table.Content>
        </Table.ScrollContainer>

        <ScrollFades
          showLeft={showLeftFade}
          showRight={showRightFade}
          gutter={scrollbarGutter}
        />
      </div>

      {footer ? (
        <Table.Footer className={FOOTER_CLASSNAME}>{footer}</Table.Footer>
      ) : null}
    </Table>
  );
}
