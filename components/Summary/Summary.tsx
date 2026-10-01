"use client";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";

import { CurrencySection } from "./components/CurrencySection";
import { LoadingSummary } from "./components/LoadingSummary";
import { MonthSelector } from "./components/MonthSelector";
import { EMPTY_ROWS, PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import { ROOT_CLASS_NAME, SECTIONS_CLASS_NAME } from "./styles";
import type { SummaryProps } from "./types";

// The month at a glance, one section per currency. The header renders at once; only the cards wait
// for their numbers.
export function Summary({
  month,
  currentMonth,
  monthLabel,
  summary,
}: SummaryProps) {
  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        aside={
          <MonthSelector
            month={month}
            label={monthLabel}
            currentMonth={currentMonth}
          />
        }
      />

      {/* Keyed by the month: another month is another set of numbers, so it gets a fresh boundary
          that shows the loading cards at once, instead of keeping the previous month's numbers on
          screen under the new month's name until the new ones arrive. */}
      <Await key={month} source={summary} fallback={<LoadingSummary />}>
        {(rows) => (
          <div className={SECTIONS_CLASS_NAME}>
            {(rows.length > 0 ? rows : EMPTY_ROWS).map((row) => (
              <CurrencySection key={row.currency} row={row} />
            ))}
          </div>
        )}
      </Await>
    </main>
  );
}
