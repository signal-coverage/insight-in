import { dateToIsoDate, isoDateToDate } from "@/core/incomes/dates";

import { monthRange, shiftMonth } from "./month";

const DAY_MS = 24 * 60 * 60 * 1000;

// The calendar date `days` days after (or, if negative, before) the given one. It works in UTC, so no
// time zone and no daylight saving change ever moves it.
export const addDays = (isoDate: string, days: number): string =>
  dateToIsoDate(new Date(isoDateToDate(isoDate).getTime() + days * DAY_MS));

// Every day of the month, first to last.
export const monthDays = (month: string): string[] => {
  const { from, to } = monthRange(month);
  const days: string[] = [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);
  }

  return days;
};

// The days the balance chart of a month shows: the whole month once it is over, up to today while it
// is in course, and none before it starts (nothing has moved yet).
export const chartDays = (month: string, today: string): string[] =>
  monthDays(month).filter((day) => day <= today);

// The `count` months that end with `month`, oldest first.
export const lastMonths = (month: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) =>
    shiftMonth(month, index - count + 1),
  );
