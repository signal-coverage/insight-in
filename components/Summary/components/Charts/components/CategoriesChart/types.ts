import type { CategoryChartRow } from "../../../../types";

export interface CategoriesChartProps {
  currency: string;
  // Largest first, "Otras" last.
  categories: readonly CategoryChartRow[];
}
