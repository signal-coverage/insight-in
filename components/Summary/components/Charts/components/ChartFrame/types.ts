import type { ReactNode } from "react";

// One series of the legend: its word and the class that paints its swatch (a theme token).
export interface ChartLegendItem {
  label: string;
  swatchClassName: string;
}

// The same numbers as the drawing, as text: one row per mark.
export interface ChartTable {
  columns: readonly string[];
  rows: readonly { key: string; cells: readonly string[] }[];
}

export interface ChartFrameProps {
  // Extra classes for the card (where it sits in a grid).
  className?: string;
  title: string;
  // Shown only with two or more series.
  legend: readonly ChartLegendItem[];
  table: ChartTable;
  // Nothing to draw: the frame shows `emptyText` instead.
  isEmpty: boolean;
  emptyText: string;
  // The drawing.
  children: ReactNode;
}
