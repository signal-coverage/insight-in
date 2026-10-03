import { Conversions } from "@/components/Conversions";
import { MONTH_PARAM } from "@/components/Summary/consts";
import { todayIso } from "@/core/incomes/dates";
import { formatMonth, monthOf, parseMonthParam } from "@/core/summary/month";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadConversionsView } from "./loadConversionsView";

export default async function OverviewInsightsPage({
  searchParams,
}: PageProps<"/dashboard/overview/insights">) {
  const userId = await requireUserId();

  // The month in course, by the Argentine calendar: what the page shows when the address asks for no
  // month, and what an address with a bad month falls back to.
  const currentMonth = monthOf(todayIso());
  const month = parseMonthParam(
    (await searchParams)[MONTH_PARAM],
    currentMonth,
  );

  // Not awaited on purpose: the database work starts here and streams in behind the page, so the
  // header is on screen at once and only the content waits for its numbers.
  const { conversions } = loadConversionsView(userId, month);

  return (
    <Conversions
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      conversions={conversions}
    />
  );
}
