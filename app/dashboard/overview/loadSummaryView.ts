import {
  settleBlock,
  toAccountRows,
  toAttentionRows,
  toChartRows,
  toOpeningBalanceData,
  toSummaryRows,
} from "@/components/Summary/utils";
import { getOpeningBalanceEditorData } from "@/core/balances/service";
import { getUserSettings } from "@/core/settings/service";
import { buildAttention } from "@/core/summary/attention";
import { readAttentionSources } from "@/core/summary/attentionSources";
import { listAccountBalanceRows } from "@/core/summary/byAccount";
import { readMonthChartSources } from "@/core/summary/charts";
import { groupAccountBalances } from "@/core/summary/groupAccounts";
import { buildMonthCharts } from "@/core/summary/series";
import { getMonthlySummary } from "@/core/summary/service";
import { summariesForTabs } from "@/core/summary/tabs";

// Starts loading every block of the overview and returns at once, without awaiting them: the page
// hands the promises straight to the client component, so its structure renders first and each block
// waits for its own numbers.
//
// The promises are created here, once per request, so their identity is stable: a client component
// that waits on them gets the same promise on every render.
//
// Isolation: the attention block and the charts never reject (a `BlockResult`), so a failing read
// shows a short error in that block only; "Por cuenta" has no rows when its read fails, as before; the
// month's numbers reject as before, which reaches the page's error boundary.
export const loadSummaryView = (
  userId: string,
  month: string,
  today: string,
) => {
  // Read once: the target remainder depends on it, and the switch that changes it shows it. The
  // switch gets its own promise, so it appears as soon as the setting is read instead of waiting for
  // the month's numbers.
  const settings = getUserSettings(userId);
  const monthSummary = settings.then(({ includeExpectedIncomes }) =>
    getMonthlySummary(userId, month, { includeExpectedIncomes }),
  );

  // What each account holds today: read once for "Por cuenta", the currency tabs and the attention
  // block (negative accounts). Independent of the month and of the settings, so it starts at once.
  const accountRows = listAccountBalanceRows(userId);
  const accountGroups = accountRows.then(groupAccountBalances);
  const accountCurrencies = accountGroups.then(
    (groups) => groups.map(({ currency }) => currency),
    (): string[] => [],
  );

  return {
    // One row per currency tab: the month's own, plus a row at zero for a currency held in an account.
    summary: Promise.all([monthSummary, accountCurrencies]).then(
      ([rows, currencies]) => toSummaryRows(summariesForTabs(rows, currencies)),
    ),
    includeExpectedIncomes: settings.then(
      ({ includeExpectedIncomes }) => includeExpectedIncomes,
    ),
    // The currencies the user hides from the month block's tabs (display only: every figure above
    // still carries every currency). Its own promise, from the same single read.
    hiddenCurrencies: settings.then(
      ({ hiddenSummaryCurrencies }) => hiddenSummaryCurrencies,
    ),
    openingBalance:
      getOpeningBalanceEditorData(userId).then(toOpeningBalanceData),
    accountBalances: accountGroups.then(toAccountRows).catch(() => []),
    attention: settleBlock(
      Promise.all([readAttentionSources(userId, today), accountRows]).then(
        ([reads, accounts]) =>
          toAttentionRows(buildAttention({ ...reads, accounts, today }), today),
      ),
    ),
    charts: settleBlock(
      Promise.all([
        readMonthChartSources(userId, month),
        monthSummary,
        accountCurrencies,
      ]).then(([sources, rows, currencies]) =>
        // The tabs' rows, not only the month's: a currency held only in an account gets its line too.
        toChartRows(
          buildMonthCharts(
            sources,
            summariesForTabs(rows, currencies),
            month,
            today,
          ),
        ),
      ),
    ),
  };
};
