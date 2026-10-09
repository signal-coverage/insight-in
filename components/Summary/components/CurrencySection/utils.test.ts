import { describe, expect, it } from "vitest";

import { SUMMARY_ROWS } from "../../consts";
import type { SummaryRow } from "../../types";
import { rowLabel, sectionLabel, valueFor } from "./utils";

const ROW: SummaryRow = {
  currency: "ARS",
  incomes: { total: "i-total", settled: "i-settled", pending: "i-pending" },
  expenses: { total: "e-total", settled: "e-settled", pending: "e-pending" },
  previous: "previous",
  current: "current",
  target: "target",
  reimbursements: "reimbursements",
  paidPercent: 60,
};

const spec = (id: string) => SUMMARY_ROWS.find((row) => row.id === id)!;

const values = (id: string) =>
  spec(id).cards.map((card) => valueFor(ROW, spec(id), card));

describe("valueFor", () => {
  it("gives the incomes row its own side, card by card", () => {
    expect(values("incomes")).toEqual([
      "i-total",
      "i-settled",
      "i-pending",
      "reimbursements",
    ]);
  });

  it("gives the expenses row its own side, card by card", () => {
    expect(values("expenses")).toEqual(["e-total", "e-settled", "e-pending"]);
  });

  it("gives the remainders row the previous balance and the two remainders", () => {
    expect(values("remainders")).toEqual(["previous", "current", "target"]);
  });
});

describe("labels", () => {
  it("names a row after its title and its currency", () => {
    expect(rowLabel("Ingresos", "ARS")).toBe("Ingresos en ARS");
  });

  it("names a section after its currency", () => {
    expect(sectionLabel("USD")).toBe("Resumen en USD");
  });
});

describe("SUMMARY_ROWS", () => {
  it("lists incomes, expenses and remainders, in that order", () => {
    expect(SUMMARY_ROWS.map((row) => row.title)).toEqual([
      "Ingresos",
      "Gastos",
      "Remanentes",
    ]);
  });

  it("gives each side its own tone and the remainders the balance one", () => {
    expect(SUMMARY_ROWS.map((row) => row.tone)).toEqual([
      "income",
      "expense",
      "balance",
    ]);
  });

  it("explains every remainder and leaves the obvious cards without a description", () => {
    expect(spec("remainders").cards.every((card) => card.description)).toBe(
      true,
    );
    expect(
      spec("incomes")
        .cards.filter((card) => card.description)
        .map((card) => card.id),
    ).toEqual(["reimbursements"]);
  });

  it("has no wallet nor total available any more", () => {
    const ids = SUMMARY_ROWS.flatMap((row) => row.cards.map((card) => card.id));

    expect(ids).not.toContain("wallet");
    expect(ids).not.toContain("available");
  });
});
