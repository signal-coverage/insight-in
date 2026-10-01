import { toSummaryRows } from "@/components/Summary/utils";
import { getMonthlySummary } from "@/core/summary/service";

// Starts loading the month's numbers and returns at once, without awaiting them: the page hands the
// promise straight to the client component, so its structure renders first and only the cards wait.
//
// The promise is created here, once per request, so its identity is stable: a client component that
// waits on it gets the same promise on every render.
export const loadSummaryView = (userId: string, month: string) => ({
  summary: getMonthlySummary(userId, month).then(toSummaryRows),
});
