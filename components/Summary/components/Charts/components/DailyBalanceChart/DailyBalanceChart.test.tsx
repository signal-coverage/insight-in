// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { DailyChartPoint } from "../../../../types";
import { DailyBalanceChart } from "./DailyBalanceChart";

const POINTS: DailyChartPoint[] = [
  {
    date: "2026-09-01",
    dayLabel: "01/09",
    balance: 1000,
    balanceLabel: "$ 10,00",
    isNegative: false,
  },
  {
    date: "2026-09-02",
    dayLabel: "02/09",
    balance: -500,
    balanceLabel: "-$ 5,00",
    isNegative: true,
  },
  {
    date: "2026-09-03",
    dayLabel: "03/09",
    balance: 2000,
    balanceLabel: "$ 20,00",
    isNegative: false,
  },
];

const chart = () =>
  screen.getByRole("img", { name: /^Saldo día a día, en ARS/ });

describe("DailyBalanceChart", () => {
  it("draws one line through every day, named after the chart and the currency", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    const line = document.querySelector("path[data-line]");

    expect(chart()).toBeInTheDocument();
    expect(line?.getAttribute("d")?.match(/[ML]/g)).toHaveLength(3);
  });

  it("puts each day at its place: the lowest at the bottom, the highest at the top", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    // x: 8, 300, 592 (the plot is 8..592); y: [-500, 2000] onto [188, 12]:
    // 1000 -> 188 - (1500 / 2500) * 176 = 82.4, -500 -> 188, 2000 -> 12.
    expect(document.querySelector("path[data-line]")?.getAttribute("d")).toBe(
      "M8 82.4 L300 188 L592 12",
    );
  });

  it("draws the zero line only when the balance crosses it", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS} />,
    );

    expect(document.querySelector("[data-zero-line]")).not.toBeNull();

    unmount();
    render(
      <DailyBalanceChart
        currency="ARS"
        points={POINTS.filter(({ isNegative }) => !isNegative)}
      />,
    );

    expect(document.querySelector("[data-zero-line]")).toBeNull();
  });

  it("names the highest, the lowest and the last day under the line, a positive one in the normal colour", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(
      screen.getByText("Máximo $ 20,00 · Mínimo -$ 5,00"),
    ).toBeInTheDocument();
    expect(screen.getByText("03/09: $ 20,00")).not.toHaveClass("text-danger");
    expect(screen.getByText("03/09: $ 20,00")).toHaveClass("text-foreground");
  });

  it("shows the last day in the danger colour when it ends below zero", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS.slice(0, 2)} />);

    expect(screen.getByText("02/09: -$ 5,00")).toHaveClass("text-danger");
  });

  it("always marks the last day with a dot, so a month with a single day is not empty", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS.slice(0, 1)} />,
    );

    const single = document.querySelectorAll("[data-last-dot]");

    expect(single).toHaveLength(1);
    expect(single[0].getAttribute("cx")).toBe("8");
    expect(single[0].getAttribute("cy")).toBe("100");
    expect(single[0].getAttribute("r")).toBe("4");
    expect(screen.getByText("01/09: $ 10,00")).toBeInTheDocument();

    unmount();
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    // With more days it is still there, on the last one, apart from the active day's dot.
    const several = document.querySelectorAll("[data-last-dot]");

    expect(several).toHaveLength(1);
    expect(several[0].getAttribute("cx")).toBe("592");
    expect(several[0].getAttribute("cy")).toBe("12");

    fireEvent.mouseEnter(
      document.querySelector('[data-day="2026-09-02"]') as Element,
    );

    expect(document.querySelectorAll("[data-last-dot]")).toHaveLength(1);
    expect(document.querySelectorAll("circle")).toHaveLength(2);
  });

  it("paints the last day's dot in the danger colour when it is negative, and not otherwise", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS.slice(0, 2)} />,
    );

    expect(document.querySelector("[data-last-dot]")).toHaveClass(
      "fill-danger",
    );

    unmount();
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(document.querySelector("[data-last-dot]")).toHaveClass(
      "fill-accent",
    );
    expect(document.querySelector("[data-last-dot]")).not.toHaveClass(
      "fill-danger",
    );
  });

  it("keeps every attribute finite for one day, for all-negative days and for flat days", () => {
    const flat = POINTS.map((point) => ({ ...point, balance: 700 }));
    const negative = POINTS.map((point) => ({
      ...point,
      balance: -Math.abs(point.balance) - 1,
      isNegative: true,
    }));

    for (const points of [POINTS.slice(0, 1), flat, negative]) {
      const { unmount } = render(
        <DailyBalanceChart currency="ARS" points={points} />,
      );

      expect(document.querySelector("path[data-line]")).not.toBeNull();
      expect(document.body.innerHTML).not.toMatch(/NaN|Infinity/);

      unmount();
    }
  });

  it("shows a day's balance in a tooltip when the pointer is over it", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.mouseEnter(
      document.querySelector('[data-day="2026-09-02"]') as Element,
    );

    expect(screen.getByRole("tooltip")).toHaveTextContent("02/09: -$ 5,00");
  });

  it("anchors the tooltip away from the active day: first half to the right edge, second half to the left edge", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.mouseEnter(
      document.querySelector('[data-day="2026-09-01"]') as Element,
    );

    const first = screen.getByRole("tooltip").parentElement as HTMLElement;

    expect(first).toHaveClass("right-0");
    expect(first).not.toHaveClass("left-0");

    fireEvent.mouseEnter(
      document.querySelector('[data-day="2026-09-03"]') as Element,
    );

    const last = screen.getByRole("tooltip").parentElement as HTMLElement;

    expect(last).toHaveClass("left-0");
    expect(last).not.toHaveClass("right-0");
  });

  it("has its hover areas inside the drawing, so they never catch the pointer over a neighbouring chart", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS} />,
    );

    const rects = Array.from(
      document.querySelectorAll<SVGRectElement>("[data-day]"),
    ).map((rect) => ({
      x: Number(rect.getAttribute("x")),
      width: Number(rect.getAttribute("width")),
    }));

    expect(rects).toEqual([
      { x: 8, width: 146 },
      { x: 154, width: 292 },
      { x: 446, width: 146 },
    ]);

    unmount();
    render(<DailyBalanceChart currency="ARS" points={POINTS.slice(0, 1)} />);

    const single = document.querySelector("[data-day]") as Element;

    expect(single.getAttribute("x")).toBe("8");
    expect(single.getAttribute("width")).toBe("584");
  });

  it("keeps its live region mounted before anything is active, so the first move is announced", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    const live = document.querySelector("[aria-live]") as HTMLElement;

    expect(live).not.toBeNull();
    expect(live).toHaveAttribute("aria-live", "polite");
    expect(live).toBeEmptyDOMElement();
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.keyDown(chart(), { key: "ArrowRight" });

    expect(document.querySelector("[aria-live]")).toBe(live);
    expect(live).toHaveTextContent("01/09: $ 10,00");

    fireEvent.keyDown(chart(), { key: "Escape" });

    expect(live).toBeEmptyDOMElement();
  });

  it("walks the days with the arrow keys and closes with Escape", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    expect(chart()).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("01/09: $ 10,00");

    fireEvent.keyDown(chart(), { key: "ArrowRight" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("02/09");

    fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    expect(screen.getByRole("tooltip")).toHaveTextContent("01/09");

    fireEvent.keyDown(chart(), { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("stops at the last day and at the first day instead of running past them", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    for (let press = 0; press < 4; press += 1) {
      fireEvent.keyDown(chart(), { key: "ArrowRight" });
    }

    expect(screen.getByRole("tooltip")).toHaveTextContent("03/09");

    for (let press = 0; press < 4; press += 1) {
      fireEvent.keyDown(chart(), { key: "ArrowLeft" });
    }

    expect(screen.getByRole("tooltip")).toHaveTextContent("01/09");
  });

  it("starts from the last day when the first key is ArrowLeft", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.keyDown(chart(), { key: "ArrowLeft" });

    expect(screen.getByRole("tooltip")).toHaveTextContent("03/09");
  });

  it("ignores other keys", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.keyDown(chart(), { key: "a" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.keyDown(chart(), { key: "ArrowRight" });

    expect(screen.getByRole("tooltip")).toBeInTheDocument();
  });

  it("lists every day in its table", () => {
    render(<DailyBalanceChart currency="ARS" points={POINTS} />);

    fireEvent.click(screen.getByRole("button", { name: "Ver como tabla" }));

    expect(screen.getAllByRole("row")).toHaveLength(4);
  });

  it("says the month has not started when there is no day to show", () => {
    const { unmount } = render(
      <DailyBalanceChart currency="ARS" points={POINTS} />,
    );

    expect(screen.getByRole("img")).toBeInTheDocument();

    unmount();
    render(<DailyBalanceChart currency="ARS" points={[]} />);

    expect(
      screen.getByText("El mes todavía no empezó: no hay saldos para mostrar."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
