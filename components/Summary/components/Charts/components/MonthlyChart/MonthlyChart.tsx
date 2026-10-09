"use client";

import { useState } from "react";

import { cn } from "@/lib/utils/utils";

import { chartAriaLabel } from "../../consts";
import { barLength, tooltipSide } from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  BAR_GAP,
  BAR_RADIUS,
  BAR_WIDTH,
  EXPENSES_LABEL,
  INCOMES_LABEL,
  LABEL_Y,
  monthAriaLabel,
  MONTHLY_COLUMNS,
  MONTHLY_EMPTY,
  MONTHLY_LEGEND,
  MONTHLY_TITLE,
  PLOT_BOTTOM,
  PLOT_TOP,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./consts";
import {
  AXIS_TEXT_CLASS_NAME,
  BASELINE_CLASS_NAME,
  EXPENSE_BAR_CLASS_NAME,
  GROUP_CLASS_NAME,
  HIT_CLASS_NAME,
  INCOME_BAR_CLASS_NAME,
  SVG_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  TOOLTIP_LEFT_CLASS_NAME,
  TOOLTIP_RIGHT_CLASS_NAME,
  TOOLTIP_TITLE_CLASS_NAME,
  WRAPPER_CLASS_NAME,
} from "./styles";
import type { MonthlyChartProps } from "./types";

// Income against expenses of the last months, one currency: two thin bars per month from one
// baseline, one axis, the months named under them. Hover or focus a month for its amounts.
export function MonthlyChart({
  currency,
  months,
  className,
}: MonthlyChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(
    0,
    ...months.flatMap(({ incomes, expenses }) => [incomes, expenses]),
  );
  const slot = VIEW_WIDTH / Math.max(months.length, 1);
  const plotHeight = PLOT_BOTTOM - PLOT_TOP;
  const activeRow = active === null ? undefined : months[active];

  return (
    <ChartFrame
      className={className}
      title={MONTHLY_TITLE}
      legend={MONTHLY_LEGEND}
      isEmpty={months.length === 0}
      emptyText={MONTHLY_EMPTY}
      table={{
        columns: MONTHLY_COLUMNS,
        rows: months.map((row) => ({
          key: row.month,
          cells: [row.monthLabel, row.incomesLabel, row.expensesLabel],
        })),
      }}
    >
      <div className={WRAPPER_CLASS_NAME}>
        {activeRow ? (
          <div
            role="tooltip"
            className={cn(
              TOOLTIP_CLASS_NAME,
              tooltipSide(active ?? 0, months.length) === "left"
                ? TOOLTIP_LEFT_CLASS_NAME
                : TOOLTIP_RIGHT_CLASS_NAME,
            )}
          >
            <span className={TOOLTIP_TITLE_CLASS_NAME}>
              {activeRow.monthLabel}
            </span>
            <span>{`${INCOMES_LABEL}: ${activeRow.incomesLabel}`}</span>
            <span>{`${EXPENSES_LABEL}: ${activeRow.expensesLabel}`}</span>
          </div>
        ) : null}
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={SVG_CLASS_NAME}
          role="group"
          aria-label={chartAriaLabel(MONTHLY_TITLE, currency)}
        >
          <line
            x1={0}
            x2={VIEW_WIDTH}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            className={BASELINE_CLASS_NAME}
          />
          {months.map((row, index) => {
            const center = slot * index + slot / 2;
            const incomeHeight = barLength(row.incomes, max, plotHeight);
            const expenseHeight = barLength(row.expenses, max, plotHeight);

            return (
              <g
                key={row.month}
                data-month={row.month}
                tabIndex={0}
                role="img"
                aria-label={monthAriaLabel(row)}
                className={GROUP_CLASS_NAME}
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <rect
                  x={slot * index}
                  y={PLOT_TOP}
                  width={slot}
                  height={plotHeight}
                  className={HIT_CLASS_NAME}
                />
                <rect
                  data-series="incomes"
                  x={center - BAR_WIDTH - BAR_GAP / 2}
                  y={PLOT_BOTTOM - incomeHeight}
                  width={BAR_WIDTH}
                  height={incomeHeight}
                  rx={BAR_RADIUS}
                  className={INCOME_BAR_CLASS_NAME}
                />
                <rect
                  data-series="expenses"
                  x={center + BAR_GAP / 2}
                  y={PLOT_BOTTOM - expenseHeight}
                  width={BAR_WIDTH}
                  height={expenseHeight}
                  rx={BAR_RADIUS}
                  className={EXPENSE_BAR_CLASS_NAME}
                />
                <text
                  x={center}
                  y={LABEL_Y}
                  textAnchor="middle"
                  className={AXIS_TEXT_CLASS_NAME}
                >
                  {row.monthLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </ChartFrame>
  );
}
