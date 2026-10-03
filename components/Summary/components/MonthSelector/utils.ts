import { MONTH_PARAM, SUMMARY_PATH } from "../../consts";

// The address of a page for a month (the summary unless another page asks). The month in course is
// the bare page, which is what it shows without a parameter, so there is one address for it and not
// two.
export const monthHref = (
  month: string,
  currentMonth: string,
  basePath: string = SUMMARY_PATH,
): string =>
  month === currentMonth ? basePath : `${basePath}?${MONTH_PARAM}=${month}`;
