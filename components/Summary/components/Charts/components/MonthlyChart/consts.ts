import type { MonthlyChartRow } from "../../../../types";
import type { ChartLegendItem } from "../ChartFrame";
import { EXPENSE_SWATCH_CLASS_NAME, INCOME_SWATCH_CLASS_NAME } from "./styles";

export const MONTHLY_TITLE = "Ingresos y gastos de los últimos 6 meses";
export const MONTHLY_EMPTY =
  "Todavía no hay ingresos ni gastos en estos meses.";

export const INCOMES_LABEL = "Ingresos";
export const EXPENSES_LABEL = "Gastos";

export const MONTHLY_COLUMNS: readonly string[] = [
  "Mes",
  INCOMES_LABEL,
  EXPENSES_LABEL,
];

export const MONTHLY_LEGEND: readonly ChartLegendItem[] = [
  { label: INCOMES_LABEL, swatchClassName: INCOME_SWATCH_CLASS_NAME },
  { label: EXPENSES_LABEL, swatchClassName: EXPENSE_SWATCH_CLASS_NAME },
];

// The drawing's own units (the SVG scales to its width).
export const VIEW_WIDTH = 600;
export const VIEW_HEIGHT = 220;
export const PLOT_TOP = 12;
export const PLOT_BOTTOM = 190;
export const LABEL_Y = 210;
export const BAR_WIDTH = 18;
// The 2px gap between the two bars of a month.
export const BAR_GAP = 2;
export const BAR_RADIUS = 2;

export const monthAriaLabel = ({
  monthLabel,
  incomesLabel,
  expensesLabel,
}: MonthlyChartRow): string =>
  `${monthLabel}: ingresos ${incomesLabel}, gastos ${expensesLabel}`;
