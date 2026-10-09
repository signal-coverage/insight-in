// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { MonthlyChartRow } from "../../../../types";
import { MonthlyChart } from "./MonthlyChart";

const MONTHS: MonthlyChartRow[] = [
  {
    month: "2026-08",
    monthLabel: "ago 26",
    incomes: 100,
    expenses: 50,
    incomesLabel: "$ 1,00",
    expensesLabel: "$ 0,50",
  },
  {
    month: "2026-09",
    monthLabel: "sep 26",
    incomes: 200,
    expenses: 0,
    incomesLabel: "$ 2,00",
    expensesLabel: "$ 0,00",
  },
];

const ZERO_MONTHS: MonthlyChartRow[] = [
  {
    month: "2026-09",
    monthLabel: "sep 26",
    incomes: 0,
    expenses: 0,
    incomesLabel: "$ 0,00",
    expensesLabel: "$ 0,00",
  },
];

const bar = (month: string, series: "incomes" | "expenses") =>
  document.querySelector(
    `[data-month="${month}"] [data-series="${series}"]`,
  ) as SVGRectElement;

describe("MonthlyChart", () => {
  it("is named after what it shows and the currency", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(
      screen.getByRole("group", {
        name: "Ingresos y gastos de los últimos 6 meses, en ARS",
      }),
    ).toBeInTheDocument();
  });

  it("draws two bars per month, as tall as their share of the largest amount, with the theme's colours", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    // The plot is 190 - 12 = 178 tall: 200 takes all of it, 100 half, 50 a quarter.
    const tallest = Number(bar("2026-09", "incomes").getAttribute("height"));

    expect(tallest).toBe(178);
    expect(
      Number(bar("2026-08", "incomes").getAttribute("height")),
    ).toBeCloseTo(89);
    expect(
      Number(bar("2026-08", "expenses").getAttribute("height")),
    ).toBeCloseTo(44.5);
    expect(Number(bar("2026-09", "expenses").getAttribute("height"))).toBe(0);
    expect(bar("2026-08", "incomes")).toHaveClass("fill-success");
    expect(bar("2026-08", "expenses")).toHaveClass("fill-warning");
  });

  it("starts every bar at the baseline", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    // y + height = 190 for every bar, so the tallest one starts at 190 - 178 = 12.
    expect(bar("2026-09", "incomes").getAttribute("y")).toBe("12");
    expect(bar("2026-08", "incomes").getAttribute("y")).toBe("101");
  });

  it("keeps every attribute finite when no month has any amount", () => {
    render(<MonthlyChart currency="ARS" months={ZERO_MONTHS} />);

    const incomes = bar("2026-09", "incomes");

    expect(incomes).not.toBeNull();
    expect(incomes.getAttribute("height")).toBe("0");
    expect(incomes.getAttribute("y")).toBe("190");
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("names each month under its bars", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(screen.getByText("ago 26")).toBeInTheDocument();
    expect(screen.getByText("sep 26")).toBeInTheDocument();
  });

  it("places the two bars of a month side by side with a 2px gap around its center", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    // 2 months over 600: slots of 300, first center 150. Incomes: 150 - 18 - 1 = 131, expenses: 150 + 1 = 151.
    expect(bar("2026-08", "incomes").getAttribute("x")).toBe("131");
    expect(bar("2026-08", "expenses").getAttribute("x")).toBe("151");
    // Second center 450: 431 and 451.
    expect(bar("2026-09", "incomes").getAttribute("x")).toBe("431");
    expect(bar("2026-09", "expenses").getAttribute("x")).toBe("451");
  });

  it("draws a focus ring around the focused month, like the other two charts", () => {
    render(<MonthlyChart currency="USD" months={MONTHS} />);

    const group = document.querySelector("[data-month]") as Element;

    // A box-shadow ring does not paint on an SVG group: the focus is drawn as an accent outline on its band.
    expect(group.getAttribute("class")).toContain(
      "[&:focus-visible>rect:first-child]:stroke-accent",
    );
    expect(group.getAttribute("tabindex")).toBe("0");
  });

  it("anchors the tooltip away from the hovered month: left half to the right edge, right half to the left edge", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    fireEvent.mouseEnter(
      screen.getByLabelText("ago 26: ingresos $ 1,00, gastos $ 0,50"),
    );

    expect(screen.getByRole("tooltip")).toHaveClass("right-0");
    expect(screen.getByRole("tooltip")).not.toHaveClass("left-0");
    expect(screen.getByRole("tooltip")).toHaveClass("pointer-events-none");

    fireEvent.mouseEnter(
      screen.getByLabelText("sep 26: ingresos $ 2,00, gastos $ 0,00"),
    );

    expect(screen.getByRole("tooltip")).toHaveClass("left-0");
    expect(screen.getByRole("tooltip")).not.toHaveClass("right-0");
    expect(screen.getByRole("tooltip")).toHaveClass("pointer-events-none");
  });

  it("has a legend for its two series", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(screen.getByRole("list", { name: "Referencias" })).toHaveTextContent(
      "IngresosGastos",
    );
  });

  it("shows a month's amounts in a tooltip on hover, and hides it when the pointer leaves", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    const august = screen.getByLabelText(
      "ago 26: ingresos $ 1,00, gastos $ 0,50",
    );

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(august);

    expect(screen.getByRole("tooltip")).toHaveTextContent("ago 26");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Ingresos: $ 1,00");
    expect(screen.getByRole("tooltip")).toHaveTextContent("Gastos: $ 0,50");

    fireEvent.mouseLeave(august);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("reaches every month with the keyboard, the tooltip following the focus", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    const september = screen.getByLabelText(
      "sep 26: ingresos $ 2,00, gastos $ 0,00",
    );

    expect(september).toHaveAttribute("tabindex", "0");

    fireEvent.focus(september);

    expect(screen.getByRole("tooltip")).toHaveTextContent("Ingresos: $ 2,00");

    fireEvent.blur(september);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("lists the same numbers in its table", () => {
    render(<MonthlyChart currency="ARS" months={MONTHS} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getByRole("table")).toHaveTextContent("sep 26$ 2,00$ 0,00");
  });

  it("says there is nothing yet when no month has anything", () => {
    const { unmount } = render(<MonthlyChart currency="ARS" months={MONTHS} />);

    expect(screen.getByRole("group")).toBeInTheDocument();

    unmount();
    render(<MonthlyChart currency="ARS" months={[]} />);

    expect(
      screen.getByText("Todavía no hay ingresos ni gastos en estos meses."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
