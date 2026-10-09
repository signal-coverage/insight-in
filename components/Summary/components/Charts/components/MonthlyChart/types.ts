import type { MonthlyChartRow } from "../../../../types";

export interface MonthlyChartProps {
  // Extra classes for the card of the chart (where it sits in the grid).
  className?: string;
  currency: string;
  // Oldest first.
  months: readonly MonthlyChartRow[];
}
