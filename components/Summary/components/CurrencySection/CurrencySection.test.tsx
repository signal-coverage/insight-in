// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { SummaryRow } from "../../types";
import { CurrencySection } from "./CurrencySection";

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  previous: "$ 5.000,00",
  current: "$ 700,00",
  target: "$ 900,00",
  reimbursements: "$ 40,00",
  paidPercent: 60,
};

describe("CurrencySection", () => {
  it("lays the incomes, the expenses and the remainders out as three columns, in that order", () => {
    render(<CurrencySection row={ARS} />);

    const section = screen.getByRole("region", { name: "Resumen en ARS" });
    const columns = section.querySelectorAll("[data-column]");

    expect(columns).toHaveLength(3);
    expect(
      [...columns].map((column) => column.getAttribute("data-column")),
    ).toEqual(["incomes", "expenses", "remainders"]);
  });

  it("keeps the currency's code as the section's heading", () => {
    render(<CurrencySection row={ARS} />);

    expect(
      screen.getByRole("heading", { level: 3, name: "ARS" }),
    ).toBeInTheDocument();
  });

  it("shows under Gastos how much of the total is paid, as a bar and in words", () => {
    render(<CurrencySection row={ARS} />);

    const bar = screen.getByRole("progressbar", {
      name: "Pagado del total en ARS",
    });
    const expenses = screen
      .getByRole("list", { name: "Gastos en ARS" })
      .closest("[data-column]") as HTMLElement;

    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(within(expenses).getByText("60 % pagado")).toBeInTheDocument();
    expect(within(expenses).getByRole("progressbar")).toBe(bar);
  });

  it("has the paid bar only under Gastos", () => {
    render(<CurrencySection row={ARS} />);

    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    const incomes = screen
      .getByRole("list", { name: "Ingresos en ARS" })
      .closest("[data-column]") as HTMLElement;

    expect(within(incomes).queryByRole("progressbar")).toBeNull();
  });
});
