"use client";

import { Button, Skeleton, useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";

import { CurrencySection } from "./components/CurrencySection";
import { ExpectedIncomesSwitch } from "./components/ExpectedIncomesSwitch";
import { LoadingSummary } from "./components/LoadingSummary";
import { MonthSelector } from "./components/MonthSelector";
import { OpeningBalanceDrawer } from "./components/OpeningBalanceDrawer";
import {
  EMPTY_ROWS,
  OPENING_BALANCE_LABEL,
  PAGE_DESCRIPTION,
  PAGE_TITLE,
} from "./consts";
import {
  ASIDE_CLASS_NAME,
  ROOT_CLASS_NAME,
  SECTIONS_CLASS_NAME,
  SWITCH_SKELETON_CLASS_NAME,
} from "./styles";
import type { SummaryProps } from "./types";

// The month at a glance, one section per currency. The header renders at once; only the cards wait
// for their numbers.
export function Summary({
  month,
  currentMonth,
  monthLabel,
  summary,
  openingBalance,
  includeExpectedIncomes,
}: SummaryProps) {
  const openingState = useOverlayState();
  // Remounts the editor on every opening, so each one starts from what is saved.
  const [openingSession, setOpeningSession] = useState(0);

  const openOpeningBalance = () => {
    setOpeningSession((current) => current + 1);
    openingState.open();
  };

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader
        title={PAGE_TITLE}
        description={PAGE_DESCRIPTION}
        aside={
          <div className={ASIDE_CLASS_NAME}>
            <Button variant="secondary" onPress={openOpeningBalance}>
              {OPENING_BALANCE_LABEL}
            </Button>
            <MonthSelector
              month={month}
              label={monthLabel}
              currentMonth={currentMonth}
            />
          </div>
        }
      />

      {/* Tied to the Remanentes row below: it decides what the Objetivo card counts. It has its own
          promise, so it shows as soon as the setting is read, without waiting for the cards. */}
      <Await
        source={includeExpectedIncomes}
        fallback={<Skeleton className={SWITCH_SKELETON_CLASS_NAME} />}
      >
        {(isSelected) => <ExpectedIncomesSwitch isSelected={isSelected} />}
      </Await>

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

      {/* The editor mounts once its data is here; a press before that opens it on arrival. */}
      <Await source={openingBalance} fallback={null}>
        {(data) => (
          <OpeningBalanceDrawer
            isOpen={openingState.isOpen}
            onOpenChange={openingState.setOpen}
            onClose={openingState.close}
            currentMonth={currentMonth}
            data={data}
            sessionKey={openingSession}
          />
        )}
      </Await>
    </main>
  );
}
