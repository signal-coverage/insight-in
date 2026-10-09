import { shiftMonth, monthRange } from "@/core/summary/month";

import type { PriorWindow } from "./types";

// Which days' settled entries add up to the previous balance of `month`, or null when none do
// (the opening balance does not reach back before its month, and in its own month it is the
// starting point itself). Without an opening balance everything before the month counts.
export const priorEntriesWindow = (
  month: string,
  openingMonth: string | null,
): PriorWindow | null => {
  if (openingMonth !== null && month <= openingMonth) {
    return null;
  }

  return {
    from: openingMonth === null ? null : monthRange(openingMonth).from,
    to: monthRange(shiftMonth(month, -1)).to,
  };
};
