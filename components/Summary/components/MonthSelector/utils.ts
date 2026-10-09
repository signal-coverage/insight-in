import { MONTH_PARAM, SUMMARY_PATH } from "../../consts";

// The address of a page for a month (the summary unless another page asks), with any other parameter
// the page keeps (the summary's currency tab). The month in course is written as no month, which is
// what the page shows without one, so there is one address for it and not two.
export const monthHref = (
  month: string,
  currentMonth: string,
  basePath: string = SUMMARY_PATH,
  params: Readonly<Record<string, string>> = {},
): string => {
  const search = new URLSearchParams(
    month === currentMonth ? {} : { [MONTH_PARAM]: month },
  );

  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }

  const query = search.toString();

  return query ? `${basePath}?${query}` : basePath;
};
