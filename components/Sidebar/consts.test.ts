import {
  ArrowsRightLeftIcon,
  BanknotesIcon,
  BuildingLibraryIcon,
  CreditCardIcon,
  ReceiptPercentIcon,
  Squares2X2Icon,
  ViewColumnsIcon,
} from "@heroicons/react/24/outline";
import { describe, expect, it } from "vitest";

import { NAV_SECTIONS } from "./consts";

const [main, movements, accounts, apart] = NAV_SECTIONS;

const allItems = NAV_SECTIONS.flatMap((section) => section.items);
const allLabels = allItems.flatMap((item) => [
  item.label,
  ...(item.children ?? []).map((child) => child.label),
]);

describe("NAV_SECTIONS", () => {
  it("has four sections: Principal, Movimientos, Cuentas and an untitled one", () => {
    expect(NAV_SECTIONS).toHaveLength(4);
    expect(NAV_SECTIONS.map((section) => section.label)).toEqual([
      "Principal",
      "Movimientos",
      "Cuentas",
      null,
    ]);
  });

  it("puts only the summary under Principal", () => {
    expect(main.items.map((item) => item.label)).toEqual(["Resumen"]);
    expect(main.items[0].href).toBe("/dashboard/overview");
    expect(main.items[0].icon).toBe(Squares2X2Icon);
  });

  it("opens the summary's submenu with General (the summary page itself) and ends with Conversiones", () => {
    const [summary] = main.items;
    const children = summary.children ?? [];

    expect(children.map((child) => child.label)).toEqual([
      "General",
      "Conversiones",
    ]);
    expect(children.map((child) => child.href)).toEqual([
      "/dashboard/overview",
      "/dashboard/overview/insights",
    ]);
    expect(children[0].href).toBe(summary.href);
  });

  it("is only the current item on the summary page itself, not on the pages under it", () => {
    const [general, conversions] = main.items[0].children ?? [];

    expect(general.exact).toBe(true);
    expect(conversions.exact).toBeUndefined();
  });

  it("lists Ingresos, Gastos and Transferencias under Movimientos, in that order, with their icons", () => {
    expect(
      movements.items.map((item) => [item.label, item.href, item.icon]),
    ).toEqual([
      ["Ingresos", "/dashboard/incomes", BanknotesIcon],
      ["Gastos", "/dashboard/expenses", ReceiptPercentIcon],
      ["Transferencias", "/dashboard/transfers", ArrowsRightLeftIcon],
    ]);
    expect(movements.items.every((item) => item.children === undefined)).toBe(
      true,
    );
  });

  it("lists Bancos and Tarjetas under Cuentas, in that order, with their icons", () => {
    expect(
      accounts.items.map((item) => [item.label, item.href, item.icon]),
    ).toEqual([
      ["Bancos", "/dashboard/banks", BuildingLibraryIcon],
      ["Tarjetas", "/dashboard/cards", CreditCardIcon],
    ]);
    expect(accounts.items.every((item) => item.children === undefined)).toBe(
      true,
    );
  });

  it("keeps the roadmap alone, last and without a title, with a columns icon", () => {
    expect(apart.label).toBeNull();
    expect(apart.items).toHaveLength(1);
    expect(apart.items[0].label).toBe("Hoja de ruta");
    expect(apart.items[0].href).toBe("/dashboard/roadmap");
    expect(apart.items[0].icon).toBe(ViewColumnsIcon);
    expect(NAV_SECTIONS.at(-1)).toBe(apart);
  });

  it("only the last section is untitled", () => {
    expect(
      NAV_SECTIONS.slice(0, -1).every((section) => section.label !== null),
    ).toBe(true);
  });

  it("has no empty section", () => {
    expect(NAV_SECTIONS.length).toBeGreaterThan(0);
    expect(NAV_SECTIONS.every((section) => section.items.length > 0)).toBe(
      true,
    );
  });

  it("no longer lists the placeholder pages (each absent label has a present twin)", () => {
    for (const present of [
      "Resumen",
      "General",
      "Conversiones",
      "Ingresos",
      "Gastos",
      "Transferencias",
      "Bancos",
      "Tarjetas",
      "Hoja de ruta",
    ]) {
      expect(allLabels).toContain(present);
    }

    for (const removed of [
      "Proyecto",
      "Facturación",
      "Cobros",
      "Calendario",
      "Facturas",
    ]) {
      expect(allLabels).not.toContain(removed);
    }

    expect(allLabels).toHaveLength(9);
  });

  it("has a different address for every page, General being the summary's own", () => {
    // A group and its General entry share one address by design; nothing else may repeat.
    const hrefs = allItems.flatMap((item) => [
      item.href,
      ...(item.children ?? [])
        .filter((child) => !child.exact)
        .map((child) => child.href),
    ]);

    expect(hrefs.length).toBeGreaterThan(0);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
