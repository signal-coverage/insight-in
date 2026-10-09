import { MONTH_PARAM } from "@/components/Summary/consts";
import { Transfers } from "@/components/Transfers";
import { todayIso } from "@/core/incomes/dates";
import { formatMonth, monthOf, parseMonthParam } from "@/core/summary/month";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadTransfersView } from "./loadTransfersView";

export default async function TransfersPage({
  searchParams,
}: PageProps<"/dashboard/transfers">) {
  const userId = await requireUserId();

  // The month in course, by the Argentine calendar: what the page shows when the address asks for no
  // month, and what an address with a bad month falls back to.
  const currentMonth = monthOf(todayIso());
  const month = parseMonthParam(
    (await searchParams)[MONTH_PARAM],
    currentMonth,
  );

  // Not awaited on purpose: the database work starts here and streams in behind the page, so its
  // structure is on screen at once and only the table waits for its data.
  const view = loadTransfersView(userId, month);

  return (
    <Transfers
      month={month}
      currentMonth={currentMonth}
      monthLabel={formatMonth(month)}
      {...view}
    />
  );
}
