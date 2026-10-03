// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EntriesTotals } from "./EntriesTotals";
import type { EntriesTotalsProps } from "./types";

const COPY = {
  ariaLabel: "Total de ingresos por moneda",
  settledLabel: "Cobrado",
  pendingLabel: "Por cobrar",
};

const USD = {
  currency: "USD",
  label: "US$ 10,00",
  settled: "US$ 6,00",
  pending: "US$ 4,00",
};

const renderTotals = (
  props: Pick<EntriesTotalsProps, "totals"> & { isLoading?: boolean },
) => render(<EntriesTotals {...COPY} {...props} />);

const list = () => screen.getByRole("list", { name: COPY.ariaLabel });
const cards = () => within(list()).getAllByRole("listitem");

describe("EntriesTotals while the totals are loading", () => {
  const pending = new Promise<never>(() => {});

  it("shows the three placeholder cards right away, each with a skeleton where its amount will be", () => {
    renderTotals({ totals: pending });

    expect(list()).toHaveAttribute("aria-busy", "true");
    expect(cards()).toHaveLength(3);
    expect(cards()[0]).toHaveTextContent("Total");
    expect(cards()[1]).toHaveTextContent("Cobrado");
    expect(cards()[2]).toHaveTextContent("Por cobrar");
    cards().forEach((card) =>
      expect(card.querySelector(".skeleton")).not.toBeNull(),
    );
  });

  it("does not show a zero while loading, which would look like a real total", () => {
    renderTotals({ totals: pending });

    expect(list()).not.toHaveTextContent(/0[.,]00/);
    expect(list()).not.toHaveTextContent("ARS");
  });

  it("shows the real cards, and is no longer busy, once the totals arrive", async () => {
    const arrived = Promise.resolve([USD]);

    await act(async () => {
      renderTotals({ totals: arrived });
    });

    expect(
      await within(
        await screen.findByRole("list", { name: COPY.ariaLabel }),
      ).findByText("Total USD"),
    ).toBeInTheDocument();
    expect(list()).not.toHaveAttribute("aria-busy", "true");
  });
});

describe("EntriesTotals while a filter change is fetching", () => {
  it("swaps figures that are already here for the skeleton, so they never read as the new result", () => {
    renderTotals({ totals: [USD], isLoading: true });

    expect(list()).toHaveAttribute("aria-busy", "true");
    expect(list().querySelector(".skeleton")).not.toBeNull();
    expect(list()).not.toHaveTextContent("US$ 10,00");
  });
});

describe("EntriesTotals", () => {
  it("gives each currency three separate cards: total, settled and pending", () => {
    renderTotals({ totals: [USD] });

    expect(cards()).toHaveLength(3);
    expect(cards()[0]).toHaveTextContent("Total USD");
    expect(cards()[0]).toHaveTextContent("US$ 10,00");
    expect(cards()[1]).toHaveTextContent("Cobrado USD");
    expect(cards()[1]).toHaveTextContent("US$ 6,00");
    expect(cards()[2]).toHaveTextContent("Por cobrar USD");
    expect(cards()[2]).toHaveTextContent("US$ 4,00");
  });

  it("keeps each amount in its own card, not mixed with the others", () => {
    renderTotals({ totals: [USD] });

    expect(cards()[0]).not.toHaveTextContent("US$ 6,00");
    expect(cards()[1]).not.toHaveTextContent("US$ 10,00");
    expect(cards()[2]).not.toHaveTextContent("US$ 6,00");
  });

  it("lists the cards of one currency after another, then the next currency", () => {
    renderTotals({
      totals: [
        {
          currency: "ARS",
          label: "$ 1.000,00",
          settled: "$ 1.000,00",
          pending: "$ 0,00",
        },
        USD,
      ],
    });

    expect(
      cards().map((card) => card.querySelector("span")?.textContent),
    ).toEqual([
      "Total ARS",
      "Cobrado ARS",
      "Por cobrar ARS",
      "Total USD",
      "Cobrado USD",
      "Por cobrar USD",
    ]);
  });

  it("uses the words of the expenses side when they are given", () => {
    render(
      <EntriesTotals
        ariaLabel="Total de gastos por moneda"
        settledLabel="Pagado"
        pendingLabel="Por pagar"
        totals={[USD]}
      />,
    );

    const expenseCards = within(
      screen.getByRole("list", { name: "Total de gastos por moneda" }),
    ).getAllByRole("listitem");

    expect(expenseCards[1]).toHaveTextContent("Pagado USD");
    expect(expenseCards[2]).toHaveTextContent("Por pagar USD");
  });

  it("still shows the three cards when there is nothing, at zero in the default currency", () => {
    renderTotals({ totals: [] });

    expect(cards()).toHaveLength(3);
    expect(cards()[0]).toHaveTextContent("Total ARS");
    cards().forEach((card) => expect(card).toHaveTextContent(/0[.,]00/));
  });

  it("does not add the default-currency cards next to real totals", () => {
    renderTotals({ totals: [{ ...USD, currency: "EUR" }] });

    expect(screen.queryByText("Total ARS")).not.toBeInTheDocument();
    expect(screen.getByText("Total EUR")).toBeInTheDocument();
  });
});
