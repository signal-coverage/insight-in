import { DISPLAY_LOCALE } from "@/lib/locale";

// A month is written "YYYY-MM". Everything here works on those strings and on UTC, so the day a
// month starts or ends never depends on the machine's time zone.

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isValidMonth = (value: string): boolean =>
  MONTH_PATTERN.test(value);

// The month a calendar date ("YYYY-MM-DD") belongs to.
export const monthOf = (isoDate: string): string => isoDate.slice(0, 7);

const toYearAndMonth = (month: string): [number, number] => {
  const [year, monthNumber] = month.split("-").map(Number);

  return [year, monthNumber];
};

// The month `delta` months after (or, if negative, before) the given one.
export const shiftMonth = (month: string, delta: number): string => {
  const [year, monthNumber] = toYearAndMonth(month);
  const index = year * 12 + (monthNumber - 1) + delta;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = index - shiftedYear * 12 + 1;

  return `${String(shiftedYear).padStart(4, "0")}-${String(shiftedMonth).padStart(2, "0")}`;
};

// The years a month in the address may have. `Date.UTC` reads years 0 to 99 as 1900 to 1999, so
// a month like "0001-02" would get the wrong number of days; and no budget is that far away.
const MIN_YEAR = 2000;
const MAX_YEAR = 2099;

// The month an address asks for (`?month=2026-03`), or `fallback` when it asks for none, asks for
// two, or asks for something that is not a month this app can show.
export const parseMonthParam = (
  value: string | string[] | undefined,
  fallback: string,
): string => {
  if (typeof value !== "string" || !isValidMonth(value)) return fallback;

  const [year] = toYearAndMonth(value);

  return year >= MIN_YEAR && year <= MAX_YEAR ? value : fallback;
};

// The first and the last day of the month, as calendar dates.
export const monthRange = (month: string): { from: string; to: string } => {
  const [year, monthNumber] = toYearAndMonth(month);
  // Day 0 of the next month is the last day of this one.
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();

  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
};

// "Septiembre de 2026".
export const formatMonth = (
  month: string,
  locale: string = DISPLAY_LOCALE,
): string => {
  const [year, monthNumber] = toYearAndMonth(month);
  const text = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));

  return text.charAt(0).toUpperCase() + text.slice(1);
};
