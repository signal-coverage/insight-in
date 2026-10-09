import type { DailyChartPoint } from "../../../../types";

export interface DailyBalanceChartProps {
  currency: string;
  // One per day, first to last.
  points: readonly DailyChartPoint[];
}
