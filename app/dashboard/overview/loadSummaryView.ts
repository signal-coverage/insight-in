import {
  toOpeningBalanceData,
  toSummaryRows,
} from "@/components/Summary/utils";
import { getOpeningBalanceEditorData } from "@/core/balances/service";
import { getUserSettings } from "@/core/settings/service";
import { getMonthlySummary } from "@/core/summary/service";

// Starts loading the month's numbers and returns at once, without awaiting them: the page hands the
// promises straight to the client component, so its structure renders first and only the cards (and
// the opening balance editor) wait.
//
// The promises are created here, once per request, so their identity is stable: a client component
// that waits on them gets the same promise on every render.
export const loadSummaryView = (userId: string, month: string) => {
  // Read once: the target remainder depends on it, and the switch that changes it shows it. The
  // switch gets its own promise, so it appears as soon as the setting is read instead of waiting
  // for the month's numbers.
  const settings = getUserSettings(userId);

  return {
    summary: settings
      .then(({ includeExpectedIncomes }) =>
        getMonthlySummary(userId, month, { includeExpectedIncomes }),
      )
      .then(toSummaryRows),
    includeExpectedIncomes: settings.then(
      ({ includeExpectedIncomes }) => includeExpectedIncomes,
    ),
    openingBalance:
      getOpeningBalanceEditorData(userId).then(toOpeningBalanceData),
  };
};
