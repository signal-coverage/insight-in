import type { DailyChartPoint } from "../../../../types";
import { chartAriaLabel } from "../../consts";

export const DAILY_TITLE = "Saldo día a día";
export const DAILY_EMPTY =
  "El mes todavía no empezó: no hay saldos para mostrar.";

export const DAILY_COLUMNS: readonly string[] = ["Día", "Saldo"];

export const VIEW_WIDTH = 600;
export const VIEW_HEIGHT = 200;
export const PLOT_LEFT = 8;
export const PLOT_RIGHT = 592;
export const PLOT_TOP = 12;
export const PLOT_BOTTOM = 188;
export const DOT_RADIUS = 4;

// What the chart is and how to walk it with the keyboard.
export const dailyAriaLabel = (currency: string): string =>
  `${chartAriaLabel(DAILY_TITLE, currency)}. Usá las flechas para recorrer los días.`;

// "02/09: -$ 5,00".
export const pointText = ({
  dayLabel,
  balanceLabel,
}: DailyChartPoint): string => `${dayLabel}: ${balanceLabel}`;

export const rangeText = (highest: string, lowest: string): string =>
  `Máximo ${highest} · Mínimo ${lowest}`;
