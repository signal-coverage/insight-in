"use client";

import { Skeleton } from "@heroui/react";

import { Await } from "@/components/shared/Await";

import { EMPTY_ROWS } from "../../consts";
import { useSelectedCurrency } from "../../useSelectedCurrency";
import { LoadingSummary } from "../LoadingSummary";
import { MonthSelector } from "../MonthSelector";
import { CurrencyPanels } from "./components/CurrencyPanels";
import { HEADING_IDS, SECTION_TITLES } from "./consts";
import {
  HEADER_CLASS_NAME,
  HEADING_CLASS_NAME,
  HISTORY_SKELETON_CLASS_NAME,
  ROOT_CLASS_NAME,
  TITLE_ROW_CLASS_NAME,
} from "./styles";
import type { MonthSectionProps } from "./types";
import { tabAddress } from "./utils";

// One of the two month blocks: the month in detail (the figures) or the last six months (the three
// charts). Both have the month selector and one tab per currency. The chosen currency is read from the address (useSelectedCurrency: Next keeps
// useSearchParams in step with replaceState, with a link and with the back button) and picking a tab
// rewrites the address with replaceState (the numbers of every currency are already here, so nothing
// is fetched again); the month selector carries the currency to the next month.
export function MonthSection({
  view,
  month,
  currentMonth,
  monthLabel,
  summary,
  hiddenCurrencies,
  charts,
  aside,
  controls,
}: MonthSectionProps) {
  const { selected, params, retryHref } = useSelectedCurrency(
    month,
    currentMonth,
  );

  // The month view waits with the shape of its figures; the history view only has charts to wait for.
  const loading =
    view === "month" ? (
      <LoadingSummary />
    ) : (
      <Skeleton className={HISTORY_SKELETON_CLASS_NAME} />
    );

  const select = (currency: string) =>
    window.history.replaceState(
      null,
      "",
      tabAddress(window.location, month, currentMonth, currency),
    );

  return (
    <section className={ROOT_CLASS_NAME} aria-labelledby={HEADING_IDS[view]}>
      <div className={HEADER_CLASS_NAME}>
        <div className={TITLE_ROW_CLASS_NAME}>
          <h2 id={HEADING_IDS[view]} className={HEADING_CLASS_NAME}>
            {SECTION_TITLES[view]}
          </h2>
          {aside}
        </div>
        <MonthSelector
          month={month}
          label={monthLabel}
          currentMonth={currentMonth}
          params={params}
        />
      </div>

      {controls}

      {/* Keyed by the month: another month is another set of numbers, so it gets a fresh boundary
          that shows the loading figures at once, instead of keeping the previous month's numbers on
          screen under the new month's name until the new ones arrive. */}
      <Await key={month} source={summary} fallback={loading}>
        {(rows) => (
          <Await source={hiddenCurrencies} fallback={loading}>
            {(hidden) => (
              <CurrencyPanels
                view={view}
                rows={rows.length > 0 ? rows : EMPTY_ROWS}
                hidden={hidden}
                charts={charts}
                selected={selected}
                onSelect={select}
                retryHref={retryHref}
              />
            )}
          </Await>
        )}
      </Await>
    </section>
  );
}
