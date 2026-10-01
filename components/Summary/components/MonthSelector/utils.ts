import { MONTH_PARAM, SUMMARY_PATH } from "../../consts";

// The address of the summary for a month. The month in course is the bare summary, which is what
// the page shows without a parameter, so there is one address for it and not two.
export const monthHref = (month: string, currentMonth: string): string =>
  month === currentMonth
    ? SUMMARY_PATH
    : `${SUMMARY_PATH}?${MONTH_PARAM}=${month}`;
