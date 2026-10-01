// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Summary } from "./Summary";
import type { SummaryRow } from "./types";

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  current: "$ 700,00",
  target: "$ 900,00",
};

const USD: SummaryRow = {
  currency: "USD",
  incomes: { total: "US$ 50,00", settled: "US$ 50,00", pending: "US$ 0,00" },
  expenses: { total: "US$ 0,00", settled: "US$ 0,00", pending: "US$ 0,00" },
  current: "US$ 50,00",
  target: "US$ 50,00",
};

const renderSummary = (
  summary: Parameters<typeof Summary>[0]["summary"],
  month = "2026-09",
) =>
  render(
    <Summary
      month={month}
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      summary={summary}
    />,
  );

const row = (name: string) => within(screen.getByRole("list", { name }));
const card = (list: ReturnType<typeof row>, label: string) =>
  list.getByText(label).closest("li") as HTMLElement;

describe("Summary header", () => {
  it("names the page and the month it is about", () => {
    renderSummary([ARS]);

    expect(
      screen.getByRole("heading", { level: 1, name: "Resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Septiembre de 2026")).toBeInTheDocument();
  });

  it("has no Actions button, since the summary has nothing to do", () => {
    renderSummary([ARS]);

    expect(
      screen.queryByRole("button", { name: "Acciones" }),
    ).not.toBeInTheDocument();
  });

  it("has the month selector in its header, with the month it is about", () => {
    renderSummary([ARS]);

    const selector = within(screen.getByRole("navigation", { name: "Mes" }));

    expect(selector.getByText("Septiembre de 2026")).toBeInTheDocument();
    expect(
      selector.getByRole("button", { name: "Mes anterior" }),
    ).toBeInTheDocument();
    expect(
      selector.getByRole("button", { name: "Mes siguiente" }),
    ).toBeInTheDocument();
  });

  it("offers the way back to the month in course only while another month is shown", () => {
    renderSummary([ARS], "2026-03");

    expect(
      screen.getByRole("button", { name: "Mes actual" }),
    ).toBeInTheDocument();
  });

  it("shows the selector while the numbers are loading, so the month can be changed meanwhile", () => {
    renderSummary(new Promise<never>(() => {}));

    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
  });
});

describe("Summary sections", () => {
  it("gives each currency a section with its code as heading", () => {
    renderSummary([ARS, USD]);

    expect(
      screen.getByRole("heading", { level: 2, name: "ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "USD" }),
    ).toBeInTheDocument();
  });

  it("keeps the sections in the order they come", () => {
    renderSummary([ARS, USD]);

    const headings = screen
      .getAllByRole("heading", { level: 2 })
      .map((heading) => heading.textContent);

    expect(headings).toEqual(["ARS", "USD"]);
  });

  it("does not mix the amounts of different currencies", () => {
    renderSummary([ARS, USD]);

    expect(card(row("Remanentes en USD"), "Actual")).toHaveTextContent(
      "US$ 50,00",
    );
    expect(card(row("Remanentes en ARS"), "Actual")).not.toHaveTextContent(
      "US$",
    );
  });
});

describe("Summary rows say what they are", () => {
  it("titles each row of a currency: incomes, expenses and remainders", () => {
    renderSummary([ARS]);

    const section = within(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    );
    const titles = section
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Ingresos", "Gastos", "Remanentes"]);
  });

  it("shows the incomes as total, collected and still to collect", () => {
    renderSummary([ARS]);

    const incomes = row("Ingresos en ARS");

    expect(card(incomes, "Total")).toHaveTextContent("$ 1.400,00");
    expect(card(incomes, "Cobrado")).toHaveTextContent("$ 1.000,00");
    expect(card(incomes, "Por cobrar")).toHaveTextContent("$ 400,00");
  });

  it("shows the expenses as total, paid and still to pay", () => {
    renderSummary([ARS]);

    const expenses = row("Gastos en ARS");

    expect(card(expenses, "Total")).toHaveTextContent("$ 500,00");
    expect(card(expenses, "Pagado")).toHaveTextContent("$ 300,00");
    expect(card(expenses, "Por pagar")).toHaveTextContent("$ 200,00");
  });

  it("tells the incomes and the expenses apart by colour, not just by words", () => {
    renderSummary([ARS]);

    expect(card(row("Ingresos en ARS"), "Total")).toHaveAttribute(
      "data-tone",
      "income",
    );
    expect(card(row("Gastos en ARS"), "Total")).toHaveAttribute(
      "data-tone",
      "expense",
    );
    expect(card(row("Ingresos en ARS"), "Por cobrar")).toHaveAttribute(
      "data-tone",
      "income",
    );
    expect(card(row("Gastos en ARS"), "Por pagar")).toHaveAttribute(
      "data-tone",
      "expense",
    );
  });

  it("gives the heading of each row the tone of its cards", () => {
    renderSummary([ARS]);

    const section = within(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    );

    expect(section.getByRole("heading", { name: "Ingresos" })).toHaveAttribute(
      "data-tone",
      "income",
    );
    expect(section.getByRole("heading", { name: "Gastos" })).toHaveAttribute(
      "data-tone",
      "expense",
    );
    expect(
      section.getByRole("heading", { name: "Remanentes" }),
    ).toHaveAttribute("data-tone", "balance");
  });

  it("shows the two remainders, makes them stand out and explains each one", () => {
    renderSummary([ARS]);

    const remainders = row("Remanentes en ARS");
    const current = card(remainders, "Actual");
    const target = card(remainders, "Objetivo");

    expect(current).toHaveTextContent("$ 700,00");
    expect(target).toHaveTextContent("$ 900,00");
    expect(current).toHaveAttribute("data-emphasis", "true");
    expect(target).toHaveAttribute("data-emphasis", "true");
    expect(current).toHaveTextContent("lo que tienes hoy");
    expect(target).toHaveTextContent("terminaría el mes");
  });
});

describe("Summary with nothing in the month", () => {
  it("still shows the cards, at zero in the default currency", () => {
    renderSummary([]);

    expect(
      screen.getByRole("heading", { level: 2, name: "ARS" }),
    ).toBeInTheDocument();
    expect(card(row("Remanentes en ARS"), "Actual")).toHaveTextContent(/0,00/);
  });
});

describe("Summary while the numbers are loading", () => {
  const pending = new Promise<never>(() => {});

  it("renders the page structure at once", () => {
    renderSummary(pending);

    expect(
      screen.getByRole("heading", { level: 1, name: "Resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Septiembre de 2026")).toBeInTheDocument();
  });

  it("already says what each row is, with its tone, while its amounts wait", () => {
    renderSummary(pending);

    const loading = within(
      screen.getByRole("region", { name: "Cargando resumen" }),
    );

    expect(loading.getByRole("heading", { name: "Ingresos" })).toHaveAttribute(
      "data-tone",
      "income",
    );
    expect(loading.getByRole("heading", { name: "Gastos" })).toHaveAttribute(
      "data-tone",
      "expense",
    );
    expect(
      loading.getByRole("heading", { name: "Remanentes" }),
    ).toHaveAttribute("data-tone", "balance");
  });

  it("shows skeleton cards, and no amount that could be taken for a real one", () => {
    const { container } = renderSummary(pending);

    expect(
      container.querySelectorAll(".skeleton").length,
    ).toBeGreaterThanOrEqual(8);
    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    // The header names the month ("... de 2026"); the cards themselves must carry no digit.
    expect(
      screen.getByRole("region", { name: "Cargando resumen" }),
    ).not.toHaveTextContent(/\d/);
  });

  it("swaps the skeleton for the real sections once the numbers arrive", async () => {
    await act(async () => {
      renderSummary(Promise.resolve([ARS]));
    });

    expect(
      await screen.findByRole("heading", { level: 2, name: "ARS" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".skeleton")).toBeNull();
  });
});
