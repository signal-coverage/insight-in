// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartFrame } from "./ChartFrame";
import type { ChartFrameProps } from "./types";

const TABLE: ChartFrameProps["table"] = {
  columns: ["Mes", "Ingresos"],
  rows: [
    { key: "2026-08", cells: ["ago 26", "$ 10,00"] },
    { key: "2026-09", cells: ["sep 26", "$ 20,00"] },
  ],
};

const LEGEND: ChartFrameProps["legend"] = [
  { label: "Ingresos", swatchClassName: "bg-success" },
  { label: "Gastos", swatchClassName: "bg-warning" },
];

const renderFrame = (patch: Partial<ChartFrameProps> = {}) =>
  render(
    <ChartFrame
      title="Ingresos y gastos"
      legend={LEGEND}
      table={TABLE}
      isEmpty={false}
      emptyText="Nada todavía."
      {...patch}
    >
      <svg data-testid="drawing" />
    </ChartFrame>,
  );

describe("ChartFrame", () => {
  it("is a region named by its title, with the drawing in it", () => {
    renderFrame();

    const region = screen.getByRole("region", { name: "Ingresos y gastos" });

    expect(
      within(region).getByRole("heading", {
        level: 4,
        name: "Ingresos y gastos",
      }),
    ).toBeInTheDocument();
    expect(within(region).getByTestId("drawing")).toBeInTheDocument();
  });

  it("tells whether the table is showing: the toggle is pressed only then", () => {
    renderFrame();

    expect(
      screen.getByRole("button", { name: "Ver como tabla" }),
    ).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(
      screen.getByRole("button", { name: "Ver como gráfico" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("shows the same numbers as a table on request, and goes back to the drawing", () => {
    renderFrame();

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    const table = screen.getByRole("table", { name: "Ingresos y gastos" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Mes", "Ingresos"]);
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("$ 20,00")).toBeInTheDocument();
    expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Ver como gráfico" }));

    expect(screen.getByTestId("drawing")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("has a legend with a swatch and a word for each series when there are two or more", () => {
    renderFrame();

    const legend = screen.getByRole("list", { name: "Referencias" });

    expect(
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Ingresos", "Gastos"]);
  });

  it("has no legend for a single series: the title names it", () => {
    const { unmount } = renderFrame();

    expect(
      screen.getByRole("list", { name: "Referencias" }),
    ).toBeInTheDocument();

    unmount();
    renderFrame({ legend: [LEGEND[0]] });

    expect(
      screen.queryByRole("list", { name: "Referencias" }),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("drawing")).toBeInTheDocument();
  });

  it("says why it is empty, with no drawing, no legend and no table toggle", () => {
    const { unmount } = renderFrame();

    expect(
      screen.getByRole("button", { name: "Ver como tabla" }),
    ).toBeInTheDocument();

    unmount();
    renderFrame({ isEmpty: true });

    expect(screen.getByText("Nada todavía.")).toBeInTheDocument();
    expect(screen.queryByTestId("drawing")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ver como tabla" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("list", { name: "Referencias" }),
    ).not.toBeInTheDocument();
  });
});
