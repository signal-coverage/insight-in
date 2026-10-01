import { CalendarDate } from "@internationalized/date";
import { describe, expect, it } from "vitest";

import { fromDateValue, toDateValue } from "./utils";

describe("toDateValue", () => {
  it("turns an ISO date into a calendar date", () => {
    expect(
      toDateValue("2026-10-01")?.compare(new CalendarDate(2026, 10, 1)),
    ).toBe(0);
  });

  it.each([null, undefined, "", "not a date", "2026-13-40", "2026-1-1"])(
    "returns null for %j",
    (value) => {
      expect(toDateValue(value)).toBeNull();
    },
  );
});

describe("fromDateValue", () => {
  it("turns a calendar date into a zero-padded ISO date", () => {
    expect(fromDateValue(new CalendarDate(2026, 1, 5))).toBe("2026-01-05");
  });

  it("returns null when there is no date", () => {
    expect(fromDateValue(null)).toBeNull();
  });

  it("round-trips with toDateValue", () => {
    expect(fromDateValue(toDateValue("2026-02-28"))).toBe("2026-02-28");
  });
});
