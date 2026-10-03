import { Table } from "@heroui/react";

import { cn } from "@/lib/utils/utils";

import { SelectionCheckbox } from "../SelectionCheckbox";
import {
  ROW_BUSY_CLASSNAME,
  ROW_INTERACTIVE_CLASSNAME,
  ROW_SELECTED_CLASSNAME,
} from "../../styles";
import { cellClassName, doNothing, selectionCellClassName } from "../../utils";
import type { DataRowProps } from "./types";

// One row of data: a checkbox cell when the table selects, then a cell per column. Marked when
// selected or busy (HeroUI's row drops `aria-busy`, so the table is the one marked busy, and the
// row, which the table also disables, carries a data attribute), and pressable when the table has
// a row handler. With checkboxes a row never
// selects on a plain click (that would be too easy to do by accident), so the row declares an
// action of its own, which does nothing unless the table has a row handler.
export function DataRow<T>({
  id,
  row,
  columns,
  isSelected,
  onPress,
  selectionLabel,
  isBusy = false,
}: DataRowProps<T>) {
  const hasSelection = selectionLabel !== undefined;

  return (
    <Table.Row
      id={id}
      data-state={isSelected ? "selected" : undefined}
      data-busy={isBusy ? "true" : undefined}
      className={cn(
        ROW_SELECTED_CLASSNAME,
        onPress && ROW_INTERACTIVE_CLASSNAME,
        isBusy && ROW_BUSY_CLASSNAME,
      )}
      onAction={onPress || hasSelection ? doNothing : undefined}
      onPress={onPress ? () => onPress(row) : undefined}
    >
      {hasSelection ? (
        <Table.Cell className={selectionCellClassName()}>
          <SelectionCheckbox label={selectionLabel} />
        </Table.Cell>
      ) : null}
      {columns.map((column) => (
        <Table.Cell key={column.key} className={cellClassName(column)}>
          {column.cell(row)}
        </Table.Cell>
      ))}
    </Table.Row>
  );
}
