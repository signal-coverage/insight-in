"use client";

import { useState } from "react";

import { chartAriaLabel } from "../../consts";
import { barLength } from "../../utils";
import { ChartFrame } from "../ChartFrame";
import {
  categoryAriaLabel,
  CATEGORIES_COLUMNS,
  CATEGORIES_EMPTY,
  CATEGORIES_TITLE,
} from "./consts";
import {
  AMOUNT_CLASS_NAME,
  BAR_CLASS_NAME,
  LIST_CLASS_NAME,
  NAME_CLASS_NAME,
  OTHER_BAR_CLASS_NAME,
  ROW_CLASS_NAME,
  TOOLTIP_CLASS_NAME,
  TRACK_CLASS_NAME,
} from "./styles";
import type { CategoriesChartProps } from "./types";

// The month's expenses by category, one currency: horizontal bars, largest first, each named and with
// its amount beside it. Hover or focus a row for its share of the total.
export function CategoriesChart({
  currency,
  categories,
}: CategoriesChartProps) {
  const [active, setActive] = useState<string | null>(null);

  const max = Math.max(0, ...categories.map(({ amount }) => amount));

  return (
    <ChartFrame
      title={CATEGORIES_TITLE}
      legend={[]}
      isEmpty={categories.length === 0}
      emptyText={CATEGORIES_EMPTY}
      table={{
        columns: CATEGORIES_COLUMNS,
        rows: categories.map((category) => ({
          key: category.key,
          cells: [category.name, category.amountLabel, category.shareLabel],
        })),
      }}
    >
      <ul
        className={LIST_CLASS_NAME}
        aria-label={chartAriaLabel(CATEGORIES_TITLE, currency)}
      >
        {categories.map((category) => (
          <li
            key={category.key}
            tabIndex={0}
            aria-label={categoryAriaLabel(category)}
            className={ROW_CLASS_NAME}
            onMouseEnter={() => setActive(category.key)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => setActive(category.key)}
            onBlur={() => setActive(null)}
          >
            <span className={NAME_CLASS_NAME} title={category.name}>
              {category.name}
            </span>
            <span className={TRACK_CLASS_NAME} aria-hidden="true">
              <span
                data-bar
                className={
                  category.isOther ? OTHER_BAR_CLASS_NAME : BAR_CLASS_NAME
                }
                style={{ width: `${barLength(category.amount, max, 100)}%` }}
              />
            </span>
            <span className={AMOUNT_CLASS_NAME}>{category.amountLabel}</span>
            {active === category.key ? (
              <span role="tooltip" className={TOOLTIP_CLASS_NAME}>
                {categoryAriaLabel(category)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </ChartFrame>
  );
}
