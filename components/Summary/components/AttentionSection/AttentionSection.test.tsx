// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { AttentionGroupRow } from "../../types";
import { AttentionSection } from "./AttentionSection";

const LONG_TITLE =
  "Cuota del aire acondicionado comprado en el local del centro (3/12)";

const OVERDUE: AttentionGroupRow = {
  kind: "overdueExpense",
  title: "Gastos vencidos",
  linkLabel: "Ver gastos",
  href: "/dashboard/expenses?to=2026-10-15&status=PLANNED",
  hiddenCount: 2,
  items: [
    {
      id: "e1",
      title: LONG_TITLE,
      amountLabel: "$ 1.500,00",
      limitLabel: null,
      dateLabel: "1 oct 2026",
      severity: "danger",
    },
  ],
};

const CARDS: AttentionGroupRow = {
  kind: "cardLimit",
  title: "Tarjetas cerca del tope",
  linkLabel: "Ver Tarjetas",
  href: "/dashboard/cards",
  hiddenCount: 0,
  items: [
    {
      id: "card_1:USD",
      title: "Visa •••• 1234 · Banco Galicia",
      amountLabel: "US$ 85,00",
      limitLabel: "US$ 100,00",
      dateLabel: null,
      severity: "warning",
    },
  ],
};

describe("AttentionSection", () => {
  it("is the 'Requiere atención' section, with one group per kind in the order given", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Requiere atención" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Requiere atención" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["Gastos vencidos", "Tarjetas cerca del tope"]);
  });

  it("links each group to where it is resolved", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    const overdue = screen.getByRole("group", { name: "Gastos vencidos" });
    const cards = screen.getByRole("group", {
      name: "Tarjetas cerca del tope",
    });

    expect(
      within(overdue).getByRole("link", {
        name: "Ver gastos: Gastos vencidos",
      }),
    ).toHaveAttribute(
      "href",
      "/dashboard/expenses?to=2026-10-15&status=PLANNED",
    );
    expect(
      within(cards).getByRole("link", {
        name: "Ver Tarjetas: Tarjetas cerca del tope",
      }),
    ).toHaveAttribute("href", "/dashboard/cards");
  });

  it("names each link after its group, so two that say the same still tell where they go", () => {
    const upcoming: AttentionGroupRow = {
      ...OVERDUE,
      kind: "overdueIncome",
      title: "Ingresos por cobrar",
      href: "/dashboard/incomes?to=2026-10-15&status=PLANNED",
    };

    render(<AttentionSection groups={[OVERDUE, upcoming]} />);

    expect(screen.getAllByText("Ver gastos")).toHaveLength(2);
    expect(
      screen.getByRole("link", { name: "Ver gastos: Gastos vencidos" }),
    ).toHaveAttribute("href", OVERDUE.href);
    expect(
      screen.getByRole("link", { name: "Ver gastos: Ingresos por cobrar" }),
    ).toHaveAttribute("href", upcoming.href);
  });

  it("says what each item is, when, and how much, a long name cut with its full text as a title", () => {
    render(<AttentionSection groups={[OVERDUE]} />);

    const item = within(
      screen.getByRole("group", { name: "Gastos vencidos" }),
    ).getByRole("listitem");

    expect(item).toHaveTextContent("1 oct 2026");
    expect(item).toHaveTextContent("$ 1.500,00");
    expect(within(item).getByText(LONG_TITLE)).toHaveAttribute(
      "title",
      LONG_TITLE,
    );
  });

  it("shows an overdue amount in the danger colour and a warning one in the plain text colour", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(screen.getByText("$ 1.500,00")).toHaveClass("text-danger");
    expect(screen.getByText("US$ 85,00 de US$ 100,00")).not.toHaveClass(
      "text-danger",
    );
  });

  it("writes a card's usage against its cap", () => {
    render(<AttentionSection groups={[CARDS]} />);

    expect(screen.getByText("US$ 85,00 de US$ 100,00")).toBeInTheDocument();
  });

  it("counts what does not fit in a group, and says nothing when everything fits", () => {
    render(<AttentionSection groups={[OVERDUE, CARDS]} />);

    expect(
      within(screen.getByRole("group", { name: "Gastos vencidos" })).getByText(
        "y 2 más",
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole("group", { name: "Tarjetas cerca del tope" }),
      ).queryByText(/más$/),
    ).not.toBeInTheDocument();
  });

  it("renders nothing when nothing needs attention", () => {
    render(<AttentionSection groups={[OVERDUE]} />);
    expect(
      screen.getByRole("region", { name: "Requiere atención" }),
    ).toBeInTheDocument();

    const { container } = render(<AttentionSection groups={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
