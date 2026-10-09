import type { CategoryChartRow } from "../../../../types";

export const CATEGORIES_TITLE = "Gastos por categoría";
export const CATEGORIES_EMPTY = "No hay gastos en este mes.";

export const CATEGORIES_COLUMNS: readonly string[] = [
  "Categoría",
  "Monto",
  "Del total",
];

// "Comida: $ 3,00 (60 % del total)": what a row says to assistive technology and in its tooltip.
export const categoryAriaLabel = ({
  name,
  amountLabel,
  shareLabel,
}: CategoryChartRow): string =>
  `${name}: ${amountLabel} (${shareLabel} del total)`;
