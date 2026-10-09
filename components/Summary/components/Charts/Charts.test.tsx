// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CurrencyChartsRow } from "../../types";
import { Charts } from "./Charts";

const USDC: CurrencyChartsRow = {
  currency: "USDC",
  monthly: [
    {
      month: "2026-09",
      monthLabel: "sep 26",
      incomes: 1500000,
      expenses: 0,
      incomesLabel: "1,50 USDC",
      expensesLabel: "0,00 USDC",
    },
  ],
  categories: [],
  daily: [],
};

describe("Charts", () => {
  it("shows the three charts of the currency, in order", () => {
    render(<Charts row={USDC} />);

    expect(
      screen
        .getAllByRole("heading", { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Ingresos y gastos de los últimos 6 meses",
      "Gastos por categoría",
      "Saldo día a día",
    ]);
  });

  it("lays the charts out two per row from xl, one column below, none stretched across the page", () => {
    const { container } = render(<Charts row={USDC} />);

    expect(container.firstElementChild).toHaveClass("xl:grid-cols-2");
    expect(container.firstElementChild).not.toHaveClass("lg:grid-cols-3");

    for (const name of [
      "Ingresos y gastos de los últimos 6 meses",
      "Gastos por categoría",
      "Saldo día a día",
    ]) {
      expect(screen.getByRole("region", { name })).not.toHaveClass(
        "xl:col-span-2",
      );
    }
  });

  it("draws only the currency it is given, with its own labels", () => {
    render(<Charts row={USDC} />);

    expect(
      screen.getByRole("group", {
        name: "Ingresos y gastos de los últimos 6 meses, en USDC",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("sep 26: ingresos 1,50 USDC, gastos 0,00 USDC"),
    ).toBeInTheDocument();
  });

  it("keeps a chart with nothing to draw in its place, saying so", () => {
    render(<Charts row={USDC} />);

    expect(screen.getByText("No hay gastos en este mes.")).toBeInTheDocument();
    expect(
      screen.getByText("El mes todavía no empezó: no hay saldos para mostrar."),
    ).toBeInTheDocument();
  });

  it("keeps the 6-month chart in its place, saying so, when the currency has no months", () => {
    render(<Charts row={{ ...USDC, monthly: [] }} />);

    expect(
      screen.getByText("Todavía no hay ingresos ni gastos en estos meses."),
    ).toBeInTheDocument();
  });

  it("draws the categories and the days when it has them", () => {
    render(
      <Charts
        row={{
          ...USDC,
          categories: [
            {
              key: "cat_food",
              name: "Comida",
              amount: 300,
              amountLabel: "0,30 USDC",
              shareLabel: "100 %",
              isOther: false,
            },
          ],
          daily: [
            {
              date: "2026-09-01",
              dayLabel: "01/09",
              balance: 5,
              balanceLabel: "0,01 USDC",
              isNegative: false,
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText("No hay gastos en este mes.")).toBeNull();
    expect(
      screen.getByLabelText("Comida: 0,30 USDC (100 % del total)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: /^Saldo día a día, en USDC/ }),
    ).toBeInTheDocument();
  });
});
