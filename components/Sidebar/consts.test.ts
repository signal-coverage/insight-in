import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "./consts";

describe("NAV_ITEMS", () => {
  it("opens with the summary, then incomes and expenses", () => {
    expect(NAV_ITEMS.slice(0, 3).map((item) => item.label)).toEqual([
      "Resumen",
      "Ingresos",
      "Gastos",
    ]);
  });

  it("leads to the real summary page", () => {
    expect(NAV_ITEMS[0].href).toBe("/dashboard/overview");
  });

  it("opens the summary's submenu with General, which is the summary page itself", () => {
    const [general] = NAV_ITEMS[0].children ?? [];

    expect(general.label).toBe("General");
    expect(general.href).toBe(NAV_ITEMS[0].href);
  });

  it("is only the current item on the summary page itself, not on the pages under it", () => {
    const [general] = NAV_ITEMS[0].children ?? [];

    expect(general.exact).toBe(true);
  });

  it("keeps the placeholder pages under the summary exactly as they were, after General", () => {
    expect(NAV_ITEMS[0].children?.map((child) => child.label)).toEqual([
      "General",
      "Proyecto",
      "Facturación",
      "Análisis",
    ]);
  });

  it("keeps the other placeholders after the real pages", () => {
    expect(NAV_ITEMS.slice(3).map((item) => item.label)).toEqual([
      "Cobros",
      "Calendario",
      "Facturas",
    ]);
  });

  it("has a different address for every page, General being the summary's own", () => {
    // A group and its General entry share one address by design; nothing else may repeat.
    const hrefs = NAV_ITEMS.flatMap((item) => [
      item.href,
      ...(item.children ?? [])
        .filter((child) => !child.exact)
        .map((child) => child.href),
    ]);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
