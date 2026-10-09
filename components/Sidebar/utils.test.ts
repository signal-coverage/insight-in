import { Squares2X2Icon } from "@heroicons/react/24/outline";
import { describe, expect, it } from "vitest";

import type { NavSection } from "./types";
import { filterNavSections } from "./utils";

const icon = Squares2X2Icon;

const SECTIONS: readonly NavSection[] = [
  {
    label: "Principal",
    items: [
      {
        label: "Resumen",
        href: "/dashboard/overview",
        icon,
        children: [
          { label: "General", href: "/dashboard/overview", icon, exact: true },
          { label: "Conversiones", href: "/dashboard/overview/insights", icon },
        ],
      },
    ],
  },
  {
    label: "Movimientos",
    items: [
      { label: "Ingresos", href: "/dashboard/incomes", icon },
      { label: "Gastos", href: "/dashboard/expenses", icon },
    ],
  },
  {
    label: null,
    items: [{ label: "Hoja de ruta", href: "/dashboard/roadmap", icon }],
  },
];

describe("filterNavSections", () => {
  it("returns every section unchanged for a blank query", () => {
    expect(filterNavSections(SECTIONS, "")).toBe(SECTIONS);
    expect(filterNavSections(SECTIONS, "   ")).toBe(SECTIONS);
  });

  it("keeps only the matching items, across sections, with their section titles", () => {
    const result = filterNavSections(SECTIONS, "s");

    expect(
      result.map((section) => [
        section.label,
        section.items.map((item) => item.label),
      ]),
    ).toEqual([
      ["Principal", ["Resumen"]],
      ["Movimientos", ["Ingresos", "Gastos"]],
    ]);
  });

  it("drops a section with no match together with its title, and keeps the one that matches", () => {
    const result = filterNavSections(SECTIONS, "gastos");

    expect(result.map((section) => section.label)).toEqual(["Movimientos"]);
    expect(result[0].items.map((item) => item.label)).toEqual(["Gastos"]);
  });

  it("keeps the untitled section when it matches", () => {
    const result = filterNavSections(SECTIONS, "hoja");

    expect(result).toHaveLength(1);
    expect(result[0].label).toBeNull();
    expect(result[0].items.map((item) => item.label)).toEqual(["Hoja de ruta"]);
  });

  it("keeps the parent of a matching child, with only that child", () => {
    const result = filterNavSections(SECTIONS, "conver");

    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("Principal");
    expect(result[0].items[0].label).toBe("Resumen");
    expect(result[0].items[0].children?.map((child) => child.label)).toEqual([
      "Conversiones",
    ]);
  });

  it("matches without caring about case or surrounding spaces", () => {
    const result = filterNavSections(SECTIONS, "  INGRESOS ");

    expect(result.flatMap((s) => s.items.map((i) => i.label))).toEqual([
      "Ingresos",
    ]);
  });

  it("returns no section when nothing matches", () => {
    expect(filterNavSections(SECTIONS, "zzz")).toEqual([]);
  });
});
