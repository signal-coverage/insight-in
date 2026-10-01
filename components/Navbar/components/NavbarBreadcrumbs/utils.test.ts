import { describe, expect, it } from "vitest";

import { buildCrumbs, formatSegment } from "./utils";

describe("buildCrumbs", () => {
  it("names the routes in Spanish, although their slugs stay in English", () => {
    expect(buildCrumbs("/dashboard/incomes")).toEqual([
      { label: "Panel", href: "/dashboard" },
      { label: "Ingresos" },
    ]);
  });

  it("links every crumb but the last one", () => {
    expect(buildCrumbs("/dashboard/overview/revenue")).toEqual([
      { label: "Panel", href: "/dashboard" },
      { label: "Resumen", href: "/dashboard/overview" },
      { label: "Facturación" },
    ]);
  });

  it("falls back to the capitalized slug for a segment with no Spanish name", () => {
    expect(buildCrumbs("/dashboard/some-page").at(-1)).toEqual({
      label: "Some page",
    });
  });
});

describe("formatSegment", () => {
  it("decodes the segment and capitalizes it", () => {
    expect(formatSegment("my%20page")).toBe("My page");
  });
});
