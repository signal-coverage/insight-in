import { Table } from "@heroui/react";

import {
  CELL_CLASSNAME,
  NOTE_ROW_CLASSNAME,
  ROW_NOTE_CLASSNAME,
} from "../../styles";
import type { NoteRowProps } from "./types";

// Something to say about the row above it, in a full-width row of its own.
export function NoteRow({ id, columnCount, children }: NoteRowProps) {
  return (
    <Table.Row id={id} className={NOTE_ROW_CLASSNAME}>
      <Table.Cell colSpan={columnCount} className={CELL_CLASSNAME}>
        <div className={ROW_NOTE_CLASSNAME}>{children}</div>
      </Table.Cell>
    </Table.Row>
  );
}
