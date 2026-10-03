import { CalendarDate, parseDate } from "@internationalized/date";
import type { DateValue } from "@internationalized/date";

// The app stores and submits dates as ISO "YYYY-MM-DD" strings; HeroUI's DatePicker works
// with calendar-date objects. These two functions are the only place that converts.

// Anything that is not a real ISO calendar date becomes null instead of throwing, so a bad
// stored value renders an empty field rather than crashing the form.
export const toDateValue = (
  iso: string | null | undefined,
): CalendarDate | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return null;
  }

  try {
    return parseDate(iso);
  } catch {
    return null;
  }
};

export const fromDateValue = (value: DateValue | null): string | null =>
  value ? value.toString() : null;
