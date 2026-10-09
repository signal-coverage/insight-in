"use client";

import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils/utils";

import { LEGEND_LABEL, SHOW_CHART_LABEL, SHOW_TABLE_LABEL } from "./consts";
import {
  CAPTION_CLASS_NAME,
  CELL_CLASS_NAME,
  EMPTY_CLASS_NAME,
  HEAD_CELL_CLASS_NAME,
  HEADER_CLASS_NAME,
  LEGEND_CLASS_NAME,
  LEGEND_ITEM_CLASS_NAME,
  ROOT_CLASS_NAME,
  SWATCH_CLASS_NAME,
  TABLE_CLASS_NAME,
  TITLE_CLASS_NAME,
} from "./styles";
import type { ChartFrameProps } from "./types";

// What every chart shares: its title, a legend when it has two series or more, and a toggle that shows
// the same numbers as a table, so nothing is only in the drawing.
export function ChartFrame({
  className,
  title,
  legend,
  table,
  isEmpty,
  emptyText,
  children,
}: ChartFrameProps) {
  const [showsTable, setShowsTable] = useState(false);

  let body: ReactNode = children;

  if (showsTable) {
    body = (
      <table className={TABLE_CLASS_NAME}>
        <caption className={CAPTION_CLASS_NAME}>{title}</caption>
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column} scope="col" className={HEAD_CELL_CLASS_NAME}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.key}>
              {row.cells.map((cell, index) => (
                <td key={table.columns[index]} className={CELL_CLASS_NAME}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (isEmpty) {
    body = <p className={EMPTY_CLASS_NAME}>{emptyText}</p>;
  }

  return (
    <section className={cn(ROOT_CLASS_NAME, className)} aria-label={title}>
      <div className={HEADER_CLASS_NAME}>
        <h4 className={TITLE_CLASS_NAME}>{title}</h4>
        {isEmpty ? null : (
          <Button
            size="sm"
            variant="tertiary"
            aria-pressed={showsTable}
            onPress={() => setShowsTable((current) => !current)}
          >
            {showsTable ? SHOW_CHART_LABEL : SHOW_TABLE_LABEL}
          </Button>
        )}
      </div>
      {legend.length > 1 && !isEmpty ? (
        <ul className={LEGEND_CLASS_NAME} aria-label={LEGEND_LABEL}>
          {legend.map((item) => (
            <li key={item.label} className={LEGEND_ITEM_CLASS_NAME}>
              <span
                className={cn(SWATCH_CLASS_NAME, item.swatchClassName)}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      ) : null}
      {body}
    </section>
  );
}
