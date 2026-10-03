"use client";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";
import { MonthSelector } from "@/components/Summary/components/MonthSelector";

import { EmptyConversions } from "./components/EmptyConversions";
import { EvolutionBlock } from "./components/EvolutionBlock";
import { LoadingConversions } from "./components/LoadingConversions";
import { SideBlock } from "./components/SideBlock";
import { CONVERSIONS_PATH, PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import { ROOT_CLASS_NAME, SECTIONS_CLASS_NAME } from "./styles";
import type { ConversionsProps } from "./types";
import { hasMonthConversions } from "./utils";

// What was converted in the month, and at what rate: the incomes whose net amount came from another
// currency, the expenses that were priced in one, and how each pair's rate moved over the last
// months. The header renders at once; only the content waits for its numbers.
export function Conversions({
  month,
  currentMonth,
  monthLabel,
  conversions,
}: ConversionsProps) {
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
            basePath={CONVERSIONS_PATH}
          />
        }
      />

      {/* Keyed by the month: another month is another set of numbers, so it gets a fresh boundary
          that shows the placeholder at once, instead of keeping the previous month's numbers on
          screen under the new month's name until the new ones arrive. */}
      <Await key={month} source={conversions} fallback={<LoadingConversions />}>
        {(view) => (
          <div className={SECTIONS_CLASS_NAME}>
            {hasMonthConversions(view) ? null : <EmptyConversions />}
            {view.incomes.length > 0 ? (
              <SideBlock side="income" pairs={view.incomes} />
            ) : null}
            {view.expenses.length > 0 ? (
              <SideBlock side="expense" pairs={view.expenses} />
            ) : null}
            {view.evolution.length > 0 ? (
              <EvolutionBlock evolution={view.evolution} />
            ) : null}
          </div>
        )}
      </Await>
    </main>
  );
}
