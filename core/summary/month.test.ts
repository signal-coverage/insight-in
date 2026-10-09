import { describe, expect, it } from "vitest";

import {
  formatMonth,
  formatShortMonth,
  isSupportedMonth,
  isValidMonth,
  monthOf,
  monthRange,
  parseMonthParam,
  shiftMonth,
} from "./month";

describe("shiftMonth", () => {
  it("moves a month forward and back by one", () => {
    expect(shiftMonth("2026-09", 1)).toBe("2026-10");
    expect(shiftMonth("2026-09", -1)).toBe("2026-08");
  });

  it("rolls over the year at December and January", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("moves by more than one month at a time", () => {
    expect(shiftMonth("2026-09", 5)).toBe("2027-02");
    expect(shiftMonth("2026-09", -13)).toBe("2025-08");
  });

  it("leaves a month where it is when told not to move", () => {
    expect(shiftMonth("2026-09", 0)).toBe("2026-09");
  });

  it("always writes a two-digit month", () => {
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth("2026-12", -3)).toBe("2026-09");
  });
});

describe("parseMonthParam", () => {
  const FALLBACK = "2026-09";

  it("takes a valid month from the address", () => {
    expect(parseMonthParam("2026-03", FALLBACK)).toBe("2026-03");
  });

  it("falls back to the given month when the address has none", () => {
    expect(parseMonthParam(undefined, FALLBACK)).toBe(FALLBACK);
  });

  it.each(["", "2026", "2026-13", "2026-00", "2026-3", "march", "2026-03-01"])(
    "falls back instead of erroring on the malformed month %j",
    (value) => {
      expect(parseMonthParam(value, FALLBACK)).toBe(FALLBACK);
    },
  );

  it("falls back when the month is given more than once, since it is unclear which is meant", () => {
    expect(parseMonthParam(["2026-03", "2026-04"], FALLBACK)).toBe(FALLBACK);
  });

  it("falls back for years too far from today to be a budget, where Date.UTC would misread them", () => {
    expect(parseMonthParam("0001-01", FALLBACK)).toBe(FALLBACK);
    expect(parseMonthParam("1999-12", FALLBACK)).toBe(FALLBACK);
    expect(parseMonthParam("2100-01", FALLBACK)).toBe(FALLBACK);
    expect(parseMonthParam("2000-01", FALLBACK)).toBe("2000-01");
    expect(parseMonthParam("2099-12", FALLBACK)).toBe("2099-12");
  });
});

describe("monthOf", () => {
  it("takes the month out of a calendar date", () => {
    expect(monthOf("2026-09-30")).toBe("2026-09");
    expect(monthOf("2026-01-01")).toBe("2026-01");
  });
});

describe("isValidMonth", () => {
  it.each(["2026-01", "2026-12", "1999-06"])("accepts %s", (month) => {
    expect(isValidMonth(month)).toBe(true);
  });

  it.each([
    "2026-13",
    "2026-00",
    "2026-1",
    "26-01",
    "2026-01-01",
    "",
    "septiembre",
  ])("rejects %j", (month) => {
    expect(isValidMonth(month)).toBe(false);
  });
});

describe("isSupportedMonth", () => {
  it.each(["2000-01", "2026-09", "2099-12"])("accepts %s", (month) => {
    expect(isSupportedMonth(month)).toBe(true);
  });

  it.each(["1999-12", "2100-01", "0001-01", "2026-13", "2026-9", ""])(
    "rejects %j: not a month this app can show",
    (month) => {
      expect(isSupportedMonth(month)).toBe(false);
    },
  );
});

describe("monthRange", () => {
  it("runs from the first to the last day of the month", () => {
    expect(monthRange("2026-09")).toEqual({
      from: "2026-09-01",
      to: "2026-09-30",
    });
    expect(monthRange("2026-10")).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("knows February, with and without a leap day", () => {
    expect(monthRange("2026-02").to).toBe("2026-02-28");
    expect(monthRange("2028-02").to).toBe("2028-02-29");
  });

  it("handles December, whose next month is in the next year", () => {
    expect(monthRange("2026-12")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("formatMonth", () => {
  it("writes the month in Spanish with a capital letter", () => {
    expect(formatMonth("2026-09")).toBe("Septiembre de 2026");
    expect(formatMonth("2027-01")).toBe("Enero de 2027");
  });

  it("does not shift the month with the machine's time zone", () => {
    expect(formatMonth("2026-12")).toBe("Diciembre de 2026");
  });
});

describe("formatShortMonth", () => {
  it("writes a short month and year for the axis of a chart", () => {
    expect(formatShortMonth("2026-09")).toMatch(/^sep/i);
    expect(formatShortMonth("2026-09")).toMatch(/26/);
  });

  it("tells two months apart", () => {
    expect(formatShortMonth("2026-08")).not.toBe(formatShortMonth("2026-09"));
    expect(formatShortMonth("2026-08")).toMatch(/^ago/i);
  });
});
