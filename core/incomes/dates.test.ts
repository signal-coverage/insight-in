import { describe, expect, it } from "vitest";

import {
  dateToIsoDate,
  firstOfMonthIso,
  formatIncomeDate,
  formatShortDate,
  isoDateToDate,
  isValidIsoDate,
  todayIso,
} from "./dates";

describe("todayIso", () => {
  // 01:30 UTC on October 1st is still the evening of September 30th in Buenos Aires (UTC-3).
  it("gives the Argentine calendar date, not the UTC one", () => {
    expect(todayIso(new Date("2026-10-01T01:30:00Z"))).toBe("2026-09-30");
  });

  it("changes day at midnight in Buenos Aires", () => {
    expect(todayIso(new Date("2026-10-01T02:59:59Z"))).toBe("2026-09-30");
    expect(todayIso(new Date("2026-10-01T03:00:00Z"))).toBe("2026-10-01");
  });

  it("always returns a zero-padded ISO date", () => {
    expect(todayIso(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });

  it("defaults to the current moment", () => {
    expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("firstOfMonthIso", () => {
  it.each([
    ["2026-09-30", "2026-09-01"],
    ["2026-01-01", "2026-01-01"],
    ["2026-12-15", "2026-12-01"],
    ["2028-02-29", "2028-02-01"],
  ])("turns %s into %s", (input, expected) => {
    expect(firstOfMonthIso(input)).toBe(expected);
  });
});

describe("isValidIsoDate", () => {
  it("accepts a real calendar date", () => {
    expect(isValidIsoDate("2026-09-29")).toBe(true);
  });

  it("accepts a leap day only in leap years", () => {
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
  });

  it.each([
    "2026-13-01",
    "2026-00-10",
    "2026-04-31",
    "09/29/2026",
    "2026-9-9",
    "",
    "abc",
  ])("rejects %j", (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });
});

describe("isoDateToDate / dateToIsoDate", () => {
  it("maps to UTC midnight", () => {
    expect(isoDateToDate("2026-09-29").toISOString()).toBe(
      "2026-09-29T00:00:00.000Z",
    );
  });

  it("round-trips a date", () => {
    expect(dateToIsoDate(isoDateToDate("2026-01-05"))).toBe("2026-01-05");
  });
});

describe("formatIncomeDate", () => {
  it("formats without shifting the day across time zones", () => {
    expect(formatIncomeDate("2026-09-01")).toBe("1 sept 2026");
  });

  it("honours a custom locale", () => {
    expect(formatIncomeDate("2026-09-01", "de-DE")).toBe("01.09.2026");
  });
});

describe("formatShortDate", () => {
  it("writes the day and the month, day first, with two digits each", () => {
    expect(formatShortDate("2026-09-12")).toBe("12/09");
    expect(formatShortDate("2026-01-05")).toBe("05/01");
  });
});
