import { Summary } from "@/components/Summary";
import { MONTH_PARAM } from "@/components/Summary/consts";
import { todayIso } from "@/core/incomes/dates";
import { formatMonth, monthOf, parseMonthParam } from "@/core/summary/month";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadSummaryView } from "./loadSummaryView";

export default async function OverviewPage({
  searchParams,
}: PageProps<"/dashboard/overview">) {
  const userId = await requireUserId();

  // "Today" is the Argentine calendar date: it decides the month in course (what the summary shows
  // when the address asks for no month, and what a bad month falls back to) and what needs attention.
  const today = todayIso();
  const currentMonth = monthOf(today);
  const month = parseMonthParam(
    (await searchParams)[MONTH_PARAM],
    currentMonth,
  );

  // Not awaited on purpose: the database work starts here and streams in behind the page, so the
  // header is on screen at once and each block waits only for its own numbers. The chosen currency
  // tab is read from the address by the month block itself.
  const view = loadSummaryView(userId, month, today);

  return (
    <Summary
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      {...view}
    />
  );
}
