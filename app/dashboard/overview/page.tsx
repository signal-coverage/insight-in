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

  // The month in course, by the Argentine calendar: what the summary shows when the address asks
  // for no month, and what an address with a bad month falls back to.
  const currentMonth = monthOf(todayIso());
  const month = parseMonthParam(
    (await searchParams)[MONTH_PARAM],
    currentMonth,
  );

  // Not awaited on purpose: the database work starts here and streams in behind the page, so the
  // header is on screen at once and only the cards wait for their numbers.
  const { summary } = loadSummaryView(userId, month);

  return (
    <Summary
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      summary={summary}
    />
  );
}
