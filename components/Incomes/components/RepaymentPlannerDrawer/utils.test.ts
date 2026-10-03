import { describe, expect, it } from "vitest";

import type { RepaymentValues } from "./types";
import {
  initialValues,
  parseRepayment,
  previewText,
  toPayload,
  toTicketLines,
} from "./utils";

const values = (patch: Partial<RepaymentValues> = {}): RepaymentValues => ({
  description: "Préstamo a Juan",
  categoryId: "cat_1",
  currency: "ARS",
  medium: "CASH",
  amountMode: "total",
  amount: "600000",
  totalCuotas: 6,
  firstDate: "2026-10-15",
  notes: "",
  ...patch,
});

describe("initialValues", () => {
  it("starts empty, in pesos, digital, a year of installments, the first one today", () => {
    expect(initialValues("2026-10-01")).toEqual({
      description: "",
      categoryId: null,
      currency: "ARS",
      medium: "DIGITAL",
      amountMode: "total",
      amount: "",
      totalCuotas: 12,
      firstDate: "2026-10-01",
      notes: "",
    });
  });
});

describe("toPayload", () => {
  it("sends what the form holds, as an income plan, with nothing about cards", () => {
    expect(toPayload(values())).toEqual({
      kind: "income",
      description: "Préstamo a Juan",
      categoryId: "cat_1",
      currency: "ARS",
      medium: "CASH",
      notes: "",
      amount: "600000",
      amountMode: "total",
      totalCuotas: 6,
      firstDate: "2026-10-15",
    });
  });

  it("sends a piece with no value yet as a value the server refuses", () => {
    expect(
      toPayload(
        values({ categoryId: null, firstDate: null, totalCuotas: null }),
      ),
    ).toMatchObject({
      categoryId: "",
      firstDate: "",
      totalCuotas: Number.NaN,
    });
  });
});

describe("parseRepayment", () => {
  it("is the repayment as the server will read it, with the total in minor units", () => {
    expect(parseRepayment(values())?.input).toEqual({
      description: "Préstamo a Juan",
      categoryId: "cat_1",
      currency: "ARS",
      medium: "CASH",
      notes: null,
      totalCuotas: 6,
      totalAmount: 60000000,
      firstDate: "2026-10-15",
    });
  });

  it("multiplies the amount of one installment when that is what was typed", () => {
    expect(
      parseRepayment(values({ amount: "100000", amountMode: "perInstallment" }))
        ?.input.totalAmount,
    ).toBe(60000000);
  });

  it("works out the amount of an installment, exact when the total divides evenly", () => {
    expect(parseRepayment(values())).toMatchObject({
      installmentAmount: 10000000,
      isApproximate: false,
    });
  });

  it("marks the amount of an installment as approximate when the total does not divide evenly", () => {
    expect(
      parseRepayment(values({ amount: "100000.01", totalCuotas: 3 })),
    ).toMatchObject({
      installmentAmount: 3333334,
      isApproximate: true,
    });
  });

  it("knows the month of the last installment", () => {
    expect(parseRepayment(values())?.lastMonth).toBe("2027-03");
  });

  it.each([
    ["no concept", { description: "   " }],
    ["no category", { categoryId: null }],
    ["an amount that is not a number", { amount: "abc" }],
    ["a zero amount", { amount: "0" }],
    ["no number of cuotas", { totalCuotas: null }],
    ["one cuota", { totalCuotas: 1 }],
    ["sixty-one cuotas", { totalCuotas: 61 }],
    ["no first date", { firstDate: null }],
    ["a first date that does not exist", { firstDate: "2026-02-30" }],
    [
      "a last installment beyond 2099",
      { firstDate: "2099-12-15", totalCuotas: 2 },
    ],
  ])("is null with %s", (_name, patch) => {
    expect(parseRepayment(values(patch))).toBeNull();
  });
});

describe("previewText", () => {
  it("says how many installments of how much, and the total", () => {
    const summary = parseRepayment(values());

    expect(previewText(summary!)).toMatch(
      /^6 cuotas de \$\s100\.000,00 · total \$\s600\.000,00$/,
    );
  });

  it("puts ≈ before the amount of an installment only when the total does not divide evenly", () => {
    const summary = parseRepayment(
      values({ amount: "100000.01", totalCuotas: 3 }),
    );

    expect(previewText(summary!)).toMatch(
      /^3 cuotas de ≈ \$\s33\.333,34 · total \$\s100\.000,01$/,
    );
  });
});

describe("toTicketLines", () => {
  const lines = (patch: Partial<RepaymentValues> = {}) =>
    toTicketLines(parseRepayment(values(patch))!, "Préstamos");

  it("lists the repayment the way a receipt would, in order", () => {
    expect(lines().map(({ label }) => label)).toEqual([
      "Concepto",
      "Categoría",
      "Cantidad de cuotas",
      "Monto por cuota",
      "Monto total",
      "Primera cuota",
      "Última cuota estimada",
      "Medio",
    ]);
  });

  it("fills every line from the repayment", () => {
    const byLabel = Object.fromEntries(
      lines().map(({ label, value }) => [label, value]),
    );

    expect(byLabel["Concepto"]).toBe("Préstamo a Juan");
    expect(byLabel["Categoría"]).toBe("Préstamos");
    expect(byLabel["Cantidad de cuotas"]).toBe("6");
    expect(byLabel["Monto por cuota"]).toMatch(/^\$\s100\.000,00$/);
    expect(byLabel["Monto total"]).toMatch(/^\$\s600\.000,00$/);
    expect(byLabel["Primera cuota"]).toContain("2026");
    expect(byLabel["Última cuota estimada"]).toBe("Marzo de 2027");
    expect(byLabel["Medio"]).toBe("Efectivo");
  });

  it("names the digital medium too", () => {
    expect(
      lines({ medium: "DIGITAL" }).find(({ label }) => label === "Medio")
        ?.value,
    ).toBe("Digital");
  });

  it("shows the amount of an installment as approximate when the total does not divide evenly", () => {
    expect(
      lines({ amount: "100000.01", totalCuotas: 3 }).find(
        ({ label }) => label === "Monto por cuota",
      )?.value,
    ).toMatch(/^≈ \$\s33\.333,34$/);
  });

  it("has no remark under any line", () => {
    expect(lines().some(({ note }) => note !== undefined)).toBe(false);
  });
});
