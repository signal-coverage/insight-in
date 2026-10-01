import { Incomes } from "@/components/Incomes";
import { todayIso } from "@/core/incomes/dates";
import { parseEntriesQuery } from "@/core/entries/query";
import { requireUserId } from "@/lib/auth/requireUserId";

import { loadIncomesView } from "./loadIncomesView";

export default async function IncomesPage({
  searchParams,
}: PageProps<"/dashboard/incomes">) {
  const userId = await requireUserId();

  // "Today" is the Argentine calendar date. It drives the default date range and the recurring
  // catch-up.
  const today = todayIso();

  // Anything invalid in the URL falls back to a default instead of erroring; a URL with no
  // date params defaults to the current month up to today.
  const query = parseEntriesQuery(await searchParams, { today });

  // Not awaited on purpose. Everything above is quick (session, URL); the database work
  // starts here and streams in behind the page, so the page's structure is on screen at once and
  // only the table, the totals and the two selects wait for their data.
  const view = loadIncomesView(userId, query, today);

  return <Incomes today={today} query={query} {...view} />;
}
