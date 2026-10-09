// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecurringRow } from "../../../../../../types";
import { DecisionCell } from "./DecisionCell";

const ROW: RecurringRow = {
  id: "t1",
  description: "Netflix",
  amount: 150000,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Servicios",
  notes: null,
  accountId: "acc_1",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 1.500,00",
  amountDecimal: "1500.00",
  dayLabel: "Día 5",
  originAmountDecimal: null,
  referenceLabel: null,
};

const renderCell = (row: RecurringRow = ROW) =>
  render(
    <DecisionCell
      row={row}
      choice={undefined}
      isDisabled={false}
      onChange={vi.fn()}
    />,
  );

// The class a radio sits under, which carries its colour (rules in app/globals.css).
const toneOf = (name: string): string | undefined =>
  ["choice--positive", "choice--negative"].find((tone) =>
    screen.getByRole("radio", { name }).closest(`.${tone}`),
  );

describe("DecisionCell colours", () => {
  it("makes Habilitar green, since it confirms the expense", () => {
    renderCell();

    expect(toneOf("Habilitar")).toBe("choice--positive");
  });

  it("makes Quitar red, since it removes the expense for good", () => {
    renderCell();

    expect(toneOf("Quitar")).toBe("choice--negative");
  });

  it("leaves Deshabilitar neutral, since it only skips this month", () => {
    renderCell();

    expect(toneOf("Deshabilitar")).toBeUndefined();
  });

  it("shows an enabled decision with the green soft colours", () => {
    renderCell({ ...ROW, decision: "ENABLED" });

    expect(
      screen.getByText("Habilitado").closest(".bg-positive-soft"),
    ).not.toBeNull();
  });

  it("shows a disabled decision without any green", () => {
    renderCell({ ...ROW, decision: "DISABLED" });

    expect(
      screen.getByText("Deshabilitado").closest(".bg-positive-soft"),
    ).toBeNull();
  });
});
