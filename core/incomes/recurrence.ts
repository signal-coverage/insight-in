// Pure date math for recurring incomes. Everything works on YYYY-MM-DD strings and UTC
// arithmetic, so results never depend on the machine's time zone.

export type RecurrenceFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

// A run never materializes more than this many occurrences per template. When a series has
// more, the most recent ones win, so a long backfill can never block current incomes.
export const MAX_OCCURRENCES_PER_RUN = 500;

// Safety net for the iteration itself (a weekly series from year 1900 is ~7000 steps).
const MAX_ITERATIONS = 50_000;

interface Series {
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string | null;
}

const pad = (value: number, width = 2): string =>
  String(value).padStart(width, "0");

const parts = (
  isoDate: string,
): { year: number; month: number; day: number } => ({
  year: Number(isoDate.slice(0, 4)),
  month: Number(isoDate.slice(5, 7)),
  day: Number(isoDate.slice(8, 10)),
});

const daysInMonth = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const format = (year: number, month: number, day: number): string =>
  `${pad(year, 4)}-${pad(month)}-${pad(day)}`;

// The k-th occurrence, always computed from the ORIGINAL start date: Jan 31 gives Feb 28,
// then Mar 31 again, instead of drifting to the 28th forever.
const occurrenceAt = (
  { frequency, startDate }: Series,
  index: number,
): string => {
  const { year, month, day } = parts(startDate);

  if (frequency === "WEEKLY") {
    const date = new Date(Date.UTC(year, month - 1, day + index * 7));

    return format(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
    );
  }

  if (frequency === "MONTHLY") {
    const monthIndex = month - 1 + index;
    const targetYear = year + Math.floor(monthIndex / 12);
    const targetMonth = (monthIndex % 12) + 1;

    return format(
      targetYear,
      targetMonth,
      Math.min(day, daysInMonth(targetYear, targetMonth)),
    );
  }

  const targetYear = year + index;

  return format(
    targetYear,
    month,
    Math.min(day, daysInMonth(targetYear, month)),
  );
};

// Every occurrence from the start date up to the earlier of `until` and the end date, both
// inclusive, oldest first, capped to the most recent `limit`.
export const occurrenceDates = ({
  frequency,
  startDate,
  endDate = null,
  until,
  limit = MAX_OCCURRENCES_PER_RUN,
}: Series & { until: string; limit?: number }): string[] => {
  const last = endDate && endDate < until ? endDate : until;
  const dates: string[] = [];

  for (let index = 0; index < MAX_ITERATIONS; index += 1) {
    const date = occurrenceAt({ frequency, startDate }, index);

    if (date > last) {
      break;
    }

    dates.push(date);
  }

  return dates.slice(-limit);
};

// The first occurrence strictly after `after`, or null when the series ends before it.
export const nextOccurrence = ({
  frequency,
  startDate,
  endDate = null,
  after,
}: Series & { after: string }): string | null => {
  for (let index = 0; index < MAX_ITERATIONS; index += 1) {
    const date = occurrenceAt({ frequency, startDate }, index);

    if (date > after) {
      return endDate && date > endDate ? null : date;
    }
  }

  return null;
};
