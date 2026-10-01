import { APP_TIME_ZONE } from "@/lib/locale";

import { DISPLAY_LOCALE } from "./consts";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isoDateToDate = (isoDate: string): Date =>
  new Date(`${isoDate}T00:00:00.000Z`);

export const dateToIsoDate = (date: Date): string =>
  date.toISOString().slice(0, 10);

// Rejects both malformed strings and dates the calendar does not have (e.g. 2026-02-30).
export const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = isoDateToDate(value);

  return !Number.isNaN(date.getTime()) && dateToIsoDate(date) === value;
};

// Today's calendar date in Argentina, the only place the app is used for now. The server and
// the browser agree on it whatever zone they run in.
export const todayIso = (now: Date = new Date()): string =>
  // The "en-CA" locale formats as YYYY-MM-DD.
  new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

export const firstOfMonthIso = (isoDate: string): string =>
  `${isoDate.slice(0, 7)}-01`;

// Incomes are calendar dates without a time zone, so the formatter is pinned to UTC to
// keep the displayed day identical everywhere.
export const formatIncomeDate = (
  isoDate: string,
  locale: string = DISPLAY_LOCALE,
): string =>
  new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(isoDateToDate(isoDate));
