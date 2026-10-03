// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstallmentTicket } from "./InstallmentTicket";

const LINES = [
  { label: "Concepto", value: "Préstamo a Juan" },
  { label: "Primera cuota", value: "15 oct 2026", note: "Entra este mes." },
];

describe("InstallmentTicket", () => {
  it("shows the brand and the heading it is given, so one ticket serves purchases and repayments", () => {
    render(
      <InstallmentTicket
        brand="DEVOLUCIÓN EN CUOTAS"
        heading="Resumen de la devolución"
        lines={LINES}
      />,
    );

    expect(screen.getByText("DEVOLUCIÓN EN CUOTAS")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Resumen de la devolución" }),
    ).toBeVisible();
  });

  it("is a region named after its heading", () => {
    render(
      <InstallmentTicket
        brand="COMPRA EN CUOTAS"
        heading="Resumen"
        lines={LINES}
      />,
    );

    expect(screen.getByRole("region", { name: "Resumen" })).toBeVisible();
  });

  it("lists every line as a label and its value, in order", () => {
    render(
      <InstallmentTicket
        brand="COMPRA EN CUOTAS"
        heading="Resumen"
        lines={LINES}
      />,
    );

    const terms = screen.getAllByRole("term").map((term) => term.textContent);
    const definitions = screen
      .getAllByRole("definition")
      .map((definition) => definition.textContent);

    expect(terms).toEqual(["Concepto", "Primera cuota"]);
    expect(definitions).toEqual(["Préstamo a Juan", "15 oct 2026"]);
  });

  it("puts a remark under the line that has one", () => {
    render(
      <InstallmentTicket
        brand="COMPRA EN CUOTAS"
        heading="Resumen"
        lines={LINES}
      />,
    );

    expect(
      within(screen.getByRole("region")).getByText("Entra este mes."),
    ).toBeVisible();
  });
});
