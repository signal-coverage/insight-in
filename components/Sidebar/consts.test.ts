import { CreditCardIcon, ViewColumnsIcon } from "@heroicons/react/24/outline";
import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "./consts";

describe("NAV_ITEMS", () => {
  it("opens with the summary, then incomes, expenses and cards", () => {
    expect(NAV_ITEMS.slice(0, 4).map((item) => item.label)).toEqual([
      "Resumen",
      "Ingresos",
      "Gastos",
      "Tarjetas",
    ]);
  });

  it("leads to the real cards page, with a credit card icon", () => {
    const cards = NAV_ITEMS.find((item) => item.label === "Tarjetas");

    expect(cards?.href).toBe("/dashboard/cards");
    expect(cards?.icon).toBe(CreditCardIcon);
  });

  it("puts the roadmap right after the cards, with a columns icon", () => {
    expect(NAV_ITEMS[4].label).toBe("Hoja de ruta");
    expect(NAV_ITEMS[4].href).toBe("/dashboard/roadmap");
    expect(NAV_ITEMS[4].icon).toBe(ViewColumnsIcon);
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

  it("keeps the placeholder pages under the summary as they were, after General, and ends with the real Conversiones page", () => {
    expect(NAV_ITEMS[0].children?.map((child) => child.label)).toEqual([
      "General",
      "Proyecto",
      "Facturación",
      "Conversiones",
    ]);
  });

  it("leads the Conversiones entry to the page that shows the conversion statistics", () => {
    const conversions = NAV_ITEMS[0].children?.find(
      (child) => child.label === "Conversiones",
    );

    expect(conversions?.href).toBe("/dashboard/overview/insights");
  });

  it("keeps the other placeholders after the real pages", () => {
    expect(NAV_ITEMS.slice(5).map((item) => item.label)).toEqual([
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
