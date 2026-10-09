// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { CategoryChartRow } from "../../../../types";
import { CategoriesChart } from "./CategoriesChart";

const LONG_NAME =
  "Supermercado y almacén del barrio con un nombre larguísimo que no entra";

const CATEGORIES: CategoryChartRow[] = [
  {
    key: "cat_food",
    name: LONG_NAME,
    amount: 300,
    amountLabel: "$ 3,00",
    shareLabel: "60 %",
    isOther: false,
  },
  {
    key: "other",
    name: "Otras",
    amount: 150,
    amountLabel: "$ 1,50",
    shareLabel: "30 %",
    isOther: true,
  },
];

describe("CategoriesChart", () => {
  it("lists the categories in the order given, each with its amount, named after the chart and the currency", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const list = screen.getByRole("list", {
      name: "Gastos por categoría, en ARS",
    });
    const rows = within(list).getAllByRole("listitem");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("$ 3,00");
    expect(rows[1]).toHaveTextContent("Otras");
  });

  it("makes each bar as long as its share of the largest, Otras in the muted colour", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const bars = document.querySelectorAll<HTMLElement>("[data-bar]");

    expect(bars).toHaveLength(2);
    expect(bars[0].style.width).toBe("100%");
    expect(bars[1].style.width).toBe("50%");
    expect(bars[0]).toHaveClass("bg-warning-soft-foreground");
    expect(bars[0]).not.toHaveClass("bg-muted");
    expect(bars[1]).toHaveClass("bg-muted");
    expect(bars[1]).not.toHaveClass("bg-warning-soft-foreground");
  });

  it("cuts a long name and keeps its full text as a title", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    expect(screen.getByText(LONG_NAME)).toHaveAttribute("title", LONG_NAME);
    expect(screen.getByText(LONG_NAME)).toHaveClass("truncate");
  });

  it("shows the share of the total in a tooltip on hover and on focus", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const others = screen.getByLabelText("Otras: $ 1,50 (30 % del total)");

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(others);
    expect(screen.getByRole("tooltip")).toHaveTextContent("30 % del total");

    fireEvent.mouseLeave(others);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(others);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Otras");

    fireEvent.blur(others);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("makes every row reachable with the keyboard", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    const rows = screen.getAllByRole("listitem");

    expect(rows).toHaveLength(2);

    for (const row of rows) {
      expect(row).toHaveAttribute("tabindex", "0");
    }
  });

  it("lists the same numbers in its table", () => {
    render(<CategoriesChart currency="ARS" categories={CATEGORIES} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getByRole("table")).toHaveTextContent("Otras$ 1,5030 %");
  });

  it("keeps every bar at zero, finite, when the amounts are all zero", () => {
    render(
      <CategoriesChart
        currency="ARS"
        categories={[{ ...CATEGORIES[0], amount: 0, amountLabel: "$ 0,00" }]}
      />,
    );

    const bars = document.querySelectorAll<HTMLElement>("[data-bar]");

    expect(bars).toHaveLength(1);
    expect(bars[0].style.width).toBe("0%");
    expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it("says there are no expenses in the month when there is nothing to draw", () => {
    const { unmount } = render(
      <CategoriesChart currency="ARS" categories={CATEGORIES} />,
    );

    expect(screen.getByRole("list")).toBeInTheDocument();

    unmount();
    render(<CategoriesChart currency="ARS" categories={[]} />);

    expect(screen.getByText("No hay gastos en este mes.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });
});
