import { describe, expect, it } from "vitest";

import { monthHref } from "./utils";

describe("monthHref", () => {
  it("points at the summary with the month in the address", () => {
    expect(monthHref("2026-08", "2026-09")).toBe(
      "/dashboard/overview?month=2026-08",
    );
  });

  it("points at the bare summary for the month in course, which is what it shows by default", () => {
    expect(monthHref("2026-09", "2026-09")).toBe("/dashboard/overview");
  });

  it("points at another page when the selector belongs to it", () => {
    const base = "/dashboard/overview/insights";

    expect(monthHref("2026-08", "2026-09", base)).toBe(
      "/dashboard/overview/insights?month=2026-08",
    );
    expect(monthHref("2026-09", "2026-09", base)).toBe(base);
  });
});
