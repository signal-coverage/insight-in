"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";

import { cn } from "@/lib/utils/utils";

import {
  clampIndex,
  extentOf,
  hoverRects,
  linePath,
  scale,
  tooltipSide,
} from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  DAILY_COLUMNS,
  DAILY_EMPTY,
  DAILY_TITLE,
  dailyAriaLabel,
  DOT_RADIUS,
  PLOT_BOTTOM,
  PLOT_LEFT,
  PLOT_RIGHT,
  PLOT_TOP,
  pointText,
  rangeText,
  VIEW_HEIGHT,
  VIEW_WIDTH,
} from "./consts";
import {
  CAPTION_CLASS_NAME,
  CROSSHAIR_CLASS_NAME,
  DOT_CLASS_NAME,
  HIT_CLASS_NAME,
  LAST_CLASS_NAME,
  LINE_CLASS_NAME,
  LIVE_LEFT_CLASS_NAME,
  LIVE_REGION_CLASS_NAME,
  LIVE_RIGHT_CLASS_NAME,
  NEGATIVE_DOT_CLASS_NAME,
  NEGATIVE_LAST_CLASS_NAME,
  SVG_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  WRAPPER_CLASS_NAME,
  ZERO_LINE_CLASS_NAME,
} from "./styles";
import type { DailyBalanceChartProps } from "./types";

// What the accounts of one currency held at the end of each day of the month: one thin line, a zero
// line when it crosses zero, a dot on the last day (so a month with a single day still shows something)
// and the highest, the lowest and the last day written under it. Hover a day, or focus the chart and
// use the arrow keys, for that day's balance.
export function DailyBalanceChart({
  currency,
  points,
}: DailyBalanceChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const balances = points.map(({ balance }) => balance);
  const { min, max } = extentOf(balances);
  const x = (index: number) =>
    scale(index, 0, Math.max(points.length - 1, 1), PLOT_LEFT, PLOT_RIGHT);
  const y = (value: number) => scale(value, min, max, PLOT_BOTTOM, PLOT_TOP);
  const areas = hoverRects(points.length, PLOT_LEFT, PLOT_RIGHT);
  const last = points[points.length - 1];
  const highest = points.find(({ balance }) => balance === max);
  const lowest = points.find(({ balance }) => balance === min);
  const activePoint = active === null ? undefined : points[active];

  const walk = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key === "Escape") {
      setActive(null);

      return;
    }

    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
      return;
    }

    event.preventDefault();

    const step = event.key === "ArrowRight" ? 1 : -1;

    setActive((current) =>
      clampIndex(
        (current ?? (step > 0 ? -1 : points.length)) + step,
        points.length,
      ),
    );
  };

  return (
    <ChartFrame
      title={DAILY_TITLE}
      legend={[]}
      isEmpty={points.length === 0}
      emptyText={DAILY_EMPTY}
      table={{
        columns: DAILY_COLUMNS,
        rows: points.map((point) => ({
          key: point.date,
          cells: [point.dayLabel, point.balanceLabel],
        })),
      }}
    >
      <div className={WRAPPER_CLASS_NAME}>
        <div
          aria-live="polite"
          className={cn(
            LIVE_REGION_CLASS_NAME,
            active !== null && tooltipSide(active, points.length) === "left"
              ? LIVE_LEFT_CLASS_NAME
              : LIVE_RIGHT_CLASS_NAME,
          )}
        >
          {activePoint ? (
            <div role="tooltip" className={TOOLTIP_CLASS_NAME}>
              {pointText(activePoint)}
            </div>
          ) : null}
        </div>
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
          className={SVG_CLASS_NAME}
          role="img"
          tabIndex={0}
          aria-label={dailyAriaLabel(currency)}
          onKeyDown={walk}
          onBlur={() => setActive(null)}
          onMouseLeave={() => setActive(null)}
        >
          {min < 0 && max > 0 ? (
            <line
              data-zero-line
              x1={PLOT_LEFT}
              x2={PLOT_RIGHT}
              y1={y(0)}
              y2={y(0)}
              className={ZERO_LINE_CLASS_NAME}
            />
          ) : null}
          <path
            data-line
            d={linePath(
              points.map((point, index) => ({
                x: x(index),
                y: y(point.balance),
              })),
            )}
            className={LINE_CLASS_NAME}
          />
          {last ? (
            <circle
              data-last-dot
              cx={x(points.length - 1)}
              cy={y(last.balance)}
              r={DOT_RADIUS}
              className={
                last.isNegative ? NEGATIVE_DOT_CLASS_NAME : DOT_CLASS_NAME
              }
            />
          ) : null}
          {points.map((point, index) => (
            <rect
              key={point.date}
              data-day={point.date}
              x={areas[index].x}
              y={PLOT_TOP}
              width={areas[index].width}
              height={PLOT_BOTTOM - PLOT_TOP}
              className={HIT_CLASS_NAME}
              onMouseEnter={() => setActive(index)}
            />
          ))}
          {activePoint && active !== null ? (
            <>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PLOT_TOP}
                y2={PLOT_BOTTOM}
                className={CROSSHAIR_CLASS_NAME}
              />
              <circle
                cx={x(active)}
                cy={y(activePoint.balance)}
                r={DOT_RADIUS}
                className={
                  activePoint.isNegative
                    ? NEGATIVE_DOT_CLASS_NAME
                    : DOT_CLASS_NAME
                }
              />
            </>
          ) : null}
        </svg>
        {last && highest && lowest ? (
          <p className={CAPTION_CLASS_NAME}>
            <span>{rangeText(highest.balanceLabel, lowest.balanceLabel)}</span>
            <span
              className={
                last.isNegative ? NEGATIVE_LAST_CLASS_NAME : LAST_CLASS_NAME
              }
            >
              {pointText(last)}
            </span>
          </p>
        ) : null}
      </div>
    </ChartFrame>
  );
}
