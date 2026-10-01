import { describe, expect, it } from "vitest";

import {
  MAX_OCCURRENCES_PER_RUN,
  nextOccurrence,
  occurrenceDates,
} from "./recurrence";

describe("occurrenceDates", () => {
  describe("weekly", () => {
    it("repeats every 7 days from the start date, inclusive of both ends", () => {
      expect(
        occurrenceDates({
          frequency: "WEEKLY",
          startDate: "2026-01-05",
          until: "2026-02-02",
        }),
      ).toEqual([
        "2026-01-05",
        "2026-01-12",
        "2026-01-19",
        "2026-01-26",
        "2026-02-02",
      ]);
    });

    it("crosses month and year boundaries", () => {
      expect(
        occurrenceDates({
          frequency: "WEEKLY",
          startDate: "2026-12-21",
          until: "2027-01-11",
        }),
      ).toEqual(["2026-12-21", "2026-12-28", "2027-01-04", "2027-01-11"]);
    });
  });

  describe("monthly", () => {
    it("keeps the same day of the month", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-01-15",
          until: "2026-04-20",
        }),
      ).toEqual(["2026-01-15", "2026-02-15", "2026-03-15", "2026-04-15"]);
    });

    it("clamps to the last day of shorter months without drifting", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-01-31",
          until: "2026-05-31",
        }),
      ).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
        "2026-05-31",
      ]);
    });

    it("uses February 29 in leap years", () => {
      const dates = occurrenceDates({
        frequency: "MONTHLY",
        startDate: "2027-12-31",
        until: "2028-03-31",
      });

      expect(dates).toEqual([
        "2027-12-31",
        "2028-01-31",
        "2028-02-29",
        "2028-03-31",
      ]);
    });

    it("rolls over into the next year", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-11-15",
          until: "2027-02-15",
        }),
      ).toEqual(["2026-11-15", "2026-12-15", "2027-01-15", "2027-02-15"]);
    });
  });

  describe("yearly", () => {
    it("repeats on the same month and day", () => {
      expect(
        occurrenceDates({
          frequency: "YEARLY",
          startDate: "2024-03-10",
          until: "2026-03-10",
        }),
      ).toEqual(["2024-03-10", "2025-03-10", "2026-03-10"]);
    });

    it("clamps February 29 to February 28 in non-leap years and restores it in leap years", () => {
      expect(
        occurrenceDates({
          frequency: "YEARLY",
          startDate: "2024-02-29",
          until: "2028-02-29",
        }),
      ).toEqual([
        "2024-02-29",
        "2025-02-28",
        "2026-02-28",
        "2027-02-28",
        "2028-02-29",
      ]);
    });
  });

  describe("bounds", () => {
    it("returns nothing when the start date is in the future", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-10-01",
          until: "2026-09-30",
        }),
      ).toEqual([]);
    });

    it("returns only the start date when it is today", () => {
      expect(
        occurrenceDates({
          frequency: "WEEKLY",
          startDate: "2026-09-30",
          until: "2026-09-30",
        }),
      ).toEqual(["2026-09-30"]);
    });

    it("stops at the end date, inclusive", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-01-10",
          endDate: "2026-03-10",
          until: "2026-12-31",
        }),
      ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
    });

    it("ignores an end date that is after the cut-off", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-01-10",
          endDate: "2027-01-10",
          until: "2026-03-15",
        }),
      ).toEqual(["2026-01-10", "2026-02-10", "2026-03-10"]);
    });

    it("returns nothing for a series that ended before it started counting", () => {
      expect(
        occurrenceDates({
          frequency: "WEEKLY",
          startDate: "2026-06-01",
          endDate: "2026-05-01",
          until: "2026-12-31",
        }),
      ).toEqual([]);
    });
  });

  describe("cap", () => {
    it("caps a run at the documented maximum", () => {
      expect(MAX_OCCURRENCES_PER_RUN).toBe(500);
    });

    it("keeps the most recent occurrences so new ones are never blocked", () => {
      const dates = occurrenceDates({
        frequency: "WEEKLY",
        startDate: "2000-01-03",
        until: "2026-09-30",
      });

      expect(dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
      expect(dates[dates.length - 1]).toBe("2026-09-28");
      expect(dates[0] > "2000-01-03").toBe(true);
    });

    it("accepts a custom limit", () => {
      expect(
        occurrenceDates({
          frequency: "MONTHLY",
          startDate: "2026-01-01",
          until: "2026-06-01",
          limit: 3,
        }),
      ).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
    });
  });
});

describe("nextOccurrence", () => {
  it("returns the first occurrence after the given date", () => {
    expect(
      nextOccurrence({
        frequency: "MONTHLY",
        startDate: "2026-01-31",
        after: "2026-02-10",
      }),
    ).toBe("2026-02-28");
  });

  it("is strictly after: an occurrence today does not count", () => {
    expect(
      nextOccurrence({
        frequency: "WEEKLY",
        startDate: "2026-09-01",
        after: "2026-09-08",
      }),
    ).toBe("2026-09-15");
  });

  it("returns the start date when the series has not started yet", () => {
    expect(
      nextOccurrence({
        frequency: "YEARLY",
        startDate: "2027-05-05",
        after: "2026-09-30",
      }),
    ).toBe("2027-05-05");
  });

  it("returns the end date's occurrence when it is inclusive and still ahead", () => {
    expect(
      nextOccurrence({
        frequency: "MONTHLY",
        startDate: "2026-01-10",
        endDate: "2026-10-10",
        after: "2026-09-30",
      }),
    ).toBe("2026-10-10");
  });

  it("returns null once the series has ended", () => {
    expect(
      nextOccurrence({
        frequency: "MONTHLY",
        startDate: "2026-01-10",
        endDate: "2026-09-10",
        after: "2026-09-30",
      }),
    ).toBeNull();
  });

  it("handles yearly clamping", () => {
    expect(
      nextOccurrence({
        frequency: "YEARLY",
        startDate: "2024-02-29",
        after: "2026-03-01",
      }),
    ).toBe("2027-02-28");
  });
});
