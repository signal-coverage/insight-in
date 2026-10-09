import { describe, expect, it } from "vitest";

import { addDays, chartDays, lastMonths, monthDays } from "./days";

describe("addDays", () => {
  it("moves a calendar date forward and back, across months and years", () => {
    expect(addDays("2026-10-08", 7)).toBe("2026-10-15");
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("knows which years have a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
  });
});

describe("monthDays", () => {
  it("lists every day of the month, first to last", () => {
    const days = monthDays("2026-02");

    expect(days).toHaveLength(28);
    expect(days[0]).toBe("2026-02-01");
    expect(days[27]).toBe("2026-02-28");
  });
});

describe("chartDays", () => {
  it("is the whole month once it is over", () => {
    const days = chartDays("2026-09", "2026-10-08");

    expect(days).toHaveLength(30);
    expect(days[29]).toBe("2026-09-30");
  });

  it("stops at today while the month is in course", () => {
    const days = chartDays("2026-10", "2026-10-08");

    expect(days).toHaveLength(8);
    expect(days[7]).toBe("2026-10-08");
  });

  it("still has one day on the first of the month, so the balance chart has a point to draw", () => {
    expect(chartDays("2026-10", "2026-10-01")).toEqual(["2026-10-01"]);
    expect(chartDays("2026-10", "2026-09-30")).toEqual([]);
  });

  it("is empty for a month that has not started", () => {
    expect(chartDays("2026-11", "2026-10-08")).toEqual([]);
  });
});

describe("lastMonths", () => {
  it("gives the months that end with the given one, oldest first, across a year", () => {
    expect(lastMonths("2026-02", 6)).toEqual([
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});
