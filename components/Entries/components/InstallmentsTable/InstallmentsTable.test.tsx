// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { InstallmentPlanRow } from "@/components/Entries/types";

import { InstallmentsTable } from "./InstallmentsTable";
import type { InstallmentsTableCopy } from "./types";

const COPY: InstallmentsTableCopy = {
  purchaseHeader: "Concepto",
  tableLabel: "Devoluciones en cuotas",
  loadingLabel: "Cargando devoluciones en cuotas",
};

const LOAN: InstallmentPlanRow = {
  id: "plan_1",
  description: "Préstamo a Juan",
  categoryName: "Préstamos",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
  nextAmountLabel: "$ 100.000,00",
  progressLabel: "3 de 12 · quedan 9",
};

const renderTable = (
  patch: Partial<Parameters<typeof InstallmentsTable>[0]> = {},
) => {
  const onCountChange = vi.fn();

  render(
    <InstallmentsTable
      copy={COPY}
      rows={[LOAN]}
      counts={{}}
      isDisabled={false}
      onCountChange={onCountChange}
      {...patch}
    />,
  );

  return { onCountChange };
};

const countInput = () =>
  screen.getByRole("textbox", { name: "Cuotas este mes de Préstamo a Juan" });

describe("InstallmentsTable", () => {
  it("is named and headed with the words it is given, so purchases and loans share it", () => {
    renderTable();

    expect(
      screen.getByRole("grid", { name: "Devoluciones en cuotas" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Concepto", "Cuotas", "Monto por cuota", "Cuotas este mes"]);
  });

  it("describes each plan: its category under the name, its progress and the next amount", () => {
    renderTable();

    const row = screen.getByRole("row", { name: /Préstamo a Juan/ });

    expect(row).toHaveTextContent("Préstamos");
    expect(row).toHaveTextContent("3 de 12 · quedan 9");
    expect(row).toHaveTextContent("$ 100.000,00");
  });

  it("starts the stepper at the count already in the month", () => {
    renderTable();

    expect(countInput()).toHaveValue("1");
  });

  it("shows the count the user chose instead of the default", () => {
    renderTable({ counts: { plan_1: 4 } });

    expect(countInput()).toHaveValue("4");
  });

  it("bounds the stepper from 0 to the installments still pending", () => {
    const { onCountChange } = renderTable({ counts: { plan_1: 0 } });

    const [decrement, increment] = within(
      screen.getByRole("row", { name: /Préstamo a Juan/ }),
    ).getAllByRole("button");

    expect(decrement).toBeDisabled();
    expect(increment).toBeEnabled();

    // A typed count beyond the pending installments is clamped to them.
    fireEvent.change(countInput(), { target: { value: "40" } });
    fireEvent.blur(countInput());

    expect(onCountChange).toHaveBeenLastCalledWith("plan_1", 9);
  });

  it("cannot go above the pending installments with the button", () => {
    renderTable({ counts: { plan_1: 9 } });

    const [, increment] = within(
      screen.getByRole("row", { name: /Préstamo a Juan/ }),
    ).getAllByRole("button");

    expect(increment).toBeDisabled();
  });

  it("reports the plan and the new count when it changes", () => {
    const { onCountChange } = renderTable();

    fireEvent.click(
      within(screen.getByRole("row", { name: /Préstamo a Juan/ })).getAllByRole(
        "button",
      )[1],
    );

    expect(onCountChange).toHaveBeenCalledWith("plan_1", 2);
  });

  it("locks the stepper while the choices are being applied", () => {
    renderTable({ isDisabled: true });

    expect(countInput()).toBeDisabled();
  });
});
