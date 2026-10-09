"use client";

import { Button, Skeleton, useOverlayState } from "@heroui/react";
import { useState } from "react";

import { PageHeader } from "@/components/Entries/components/PageHeader";
import { Await } from "@/components/shared/Await";
import type { SummarySection } from "@/core/summary/tabs";

import { AccountsSection } from "./components/AccountsSection";
import { AttentionSection } from "./components/AttentionSection";
import { BlockError } from "./components/BlockError";
import { ExpectedIncomesSwitch } from "./components/ExpectedIncomesSwitch";
import { MonthSection } from "./components/MonthSection";
import { OpeningBalanceDrawer } from "./components/OpeningBalanceDrawer";
import { SectionTabs } from "./components/SectionTabs";
import { sectionAddress } from "./components/SectionTabs/utils";
import { OPENING_BALANCE_LABEL, PAGE_DESCRIPTION, PAGE_TITLE } from "./consts";
import {
  ACCOUNTS_SKELETON_CLASS_NAME,
  ATTENTION_SKELETON_CLASS_NAME,
  ROOT_CLASS_NAME,
  SWITCH_SKELETON_CLASS_NAME,
} from "./styles";
import type { SummaryProps } from "./types";
import { useSelectedCurrency } from "./useSelectedCurrency";

// The overview in three sections: what each account holds today and what needs attention, the month in
// detail, and the last six months, one currency at a time. The section lives in the address (like the
// currency tab) and picking one rewrites it without fetching anything: every promise is already on the
// page. The header renders at once; each block waits for its own numbers, and a block that cannot be
// read shows a short error in its place.
export function Summary({
  month,
  currentMonth,
  monthLabel,
  summary,
  openingBalance,
  includeExpectedIncomes,
  hiddenCurrencies,
  accountBalances,
  attention,
  charts,
}: SummaryProps) {
  const openingState = useOverlayState();
  // Remounts the editor on every opening, so each one starts from what is saved.
  const [openingSession, setOpeningSession] = useState(0);
  // The section the address asks for, and where "Reintentar" takes the user back to: this page as it is
  // now (month, section and currency tab).
  const { section, retryHref } = useSelectedCurrency(month, currentMonth);

  const openOpeningBalance = () => {
    setOpeningSession((current) => current + 1);
    openingState.open();
  };

  const selectSection = (next: SummarySection) =>
    window.history.replaceState(
      null,
      "",
      sectionAddress(window.location, next),
    );

  return (
    <main className={ROOT_CLASS_NAME}>
      <PageHeader title={PAGE_TITLE} description={PAGE_DESCRIPTION} />

      <SectionTabs
        selected={section}
        onSelect={selectSection}
        accounts={
          <>
            {/* Today's balance of each account: it does not depend on the month shown, so it has its
                own promise and its own boundary, and stays put when the month changes. */}
            <Await
              source={accountBalances}
              fallback={<Skeleton className={ACCOUNTS_SKELETON_CLASS_NAME} />}
            >
              {(rows) => <AccountsSection rows={rows} />}
            </Await>

            {/* What needs attention today: not rendered when nothing does. */}
            <Await
              source={attention}
              fallback={<Skeleton className={ATTENTION_SKELETON_CLASS_NAME} />}
            >
              {(result) =>
                result.status === "ok" ? (
                  <AttentionSection groups={result.value} />
                ) : (
                  <BlockError retryHref={retryHref} />
                )
              }
            </Await>
          </>
        }
        month={
          <MonthSection
            view="month"
            month={month}
            currentMonth={currentMonth}
            monthLabel={monthLabel}
            summary={summary}
            hiddenCurrencies={hiddenCurrencies}
            charts={charts}
            aside={
              <Button variant="secondary" onPress={openOpeningBalance}>
                {OPENING_BALANCE_LABEL}
              </Button>
            }
            controls={
              // Tied to the Remanentes column: it decides what the Objetivo card counts, in every
              // currency. It has its own promise, so it shows as soon as the setting is read.
              <Await
                source={includeExpectedIncomes}
                fallback={<Skeleton className={SWITCH_SKELETON_CLASS_NAME} />}
              >
                {(isSelected) => (
                  <ExpectedIncomesSwitch isSelected={isSelected} />
                )}
              </Await>
            }
          />
        }
        history={
          <MonthSection
            view="history"
            month={month}
            currentMonth={currentMonth}
            monthLabel={monthLabel}
            summary={summary}
            hiddenCurrencies={hiddenCurrencies}
            charts={charts}
          />
        }
      />

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
