// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/core/balances/actions", () => ({
  saveOpeningBalanceAction: vi.fn(),
}));
vi.mock("@/core/settings/actions", () => ({
  saveIncludeExpectedIncomesAction: vi.fn(),
}));

import { Summary } from "./Summary";
import type { OpeningBalanceData } from "./components/OpeningBalanceDrawer";
import type { SummaryRow } from "./types";

const OPENING: OpeningBalanceData = {
  month: "2026-06",
  rows: [{ currency: "ARS", digital: "5000.50", cash: "" }],
};

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  previous: "$ 5.000,00",
  current: "$ 700,00",
  target: "$ 900,00",
  wallet: "$ 250,00",
  available: "$ 950,00",
  reimbursements: "$ 40,00",
};

const USD: SummaryRow = {
  currency: "USD",
  incomes: { total: "US$ 50,00", settled: "US$ 50,00", pending: "US$ 0,00" },
  expenses: { total: "US$ 0,00", settled: "US$ 0,00", pending: "US$ 0,00" },
  previous: "US$ 0,00",
  current: "US$ 50,00",
  target: "US$ 50,00",
  wallet: "US$ 0,00",
  available: "US$ 50,00",
  reimbursements: "US$ 0,00",
};

const renderSummary = (
  summary: Parameters<typeof Summary>[0]["summary"],
  month = "2026-09",
  openingBalance: Parameters<typeof Summary>[0]["openingBalance"] = OPENING,
  includeExpectedIncomes: Parameters<
    typeof Summary
  >[0]["includeExpectedIncomes"] = true,
) =>
  render(
    <Summary
      month={month}
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      summary={summary}
      openingBalance={openingBalance}
      includeExpectedIncomes={includeExpectedIncomes}
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

describe("Summary opening balance", () => {
  it("offers a Saldo inicial button in the header, beside the month selector", () => {
    renderSummary([ARS]);

    const header = screen.getByRole("banner");

    expect(
      within(header).getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(
      within(header).getByRole("navigation", { name: "Mes" }),
    ).toBeInTheDocument();
  });

  it("does not show the editor until the button is pressed", () => {
    renderSummary([ARS]);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the editor with the saved opening balance", async () => {
    renderSummary([ARS]);

    fireEvent.click(screen.getByRole("button", { name: "Saldo inicial" }));

    const dialog = await screen.findByRole("dialog");

    expect(
      within(dialog).getByRole("heading", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Digital/)).toHaveValue("5000.50");
  });

  it("shows the button while the numbers and the saved balance are still loading", () => {
    renderSummary(
      new Promise<never>(() => {}),
      "2026-09",
      new Promise<never>(() => {}),
    );

    expect(
      screen.getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
  });

  it("opens the editor as soon as the saved balance arrives, if it was asked for meanwhile", async () => {
    let arrive!: (data: OpeningBalanceData) => void;
    const pending = new Promise<OpeningBalanceData>((resolve) => {
      arrive = resolve;
    });

    renderSummary([ARS], "2026-09", pending);

    fireEvent.click(screen.getByRole("button", { name: "Saldo inicial" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await act(async () => arrive(OPENING));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});

describe("Summary expected incomes switch", () => {
  const toggle = () =>
    screen.getByRole("switch", { name: /Sumar ingresos por cobrar/ });

  it("sits between the header and the currency sections", () => {
    renderSummary([ARS]);

    const header = screen.getByRole("banner");
    const section = screen.getByRole("region", { name: "Resumen en ARS" });

    expect(within(header).queryByRole("switch")).not.toBeInTheDocument();
    expect(
      header.compareDocumentPosition(toggle()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toggle().compareDocumentPosition(section) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("says what turning it off does", () => {
    renderSummary([ARS]);

    expect(
      screen.getByText(
        "Si lo apagás, el remanente objetivo solo resta lo que falta pagar.",
      ),
    ).toBeInTheDocument();
  });

  it("starts on when the saved setting is on", () => {
    renderSummary([ARS], "2026-09", OPENING, true);

    expect(toggle()).toBeChecked();
  });

  it("starts off when the saved setting is off", () => {
    renderSummary([ARS], "2026-09", OPENING, false);

    expect(toggle()).not.toBeChecked();
  });

  it("shows the switch while the numbers are still loading, with the saved value", async () => {
    await act(async () => {
      renderSummary(
        new Promise<never>(() => {}),
        "2026-09",
        OPENING,
        Promise.resolve(false),
      );
    });

    expect(toggle()).not.toBeChecked();
    expect(
      screen.getByRole("region", { name: "Cargando resumen" }),
    ).toBeInTheDocument();
  });

  it("waits for the saved value without showing a wrong one", () => {
    renderSummary([ARS], "2026-09", OPENING, new Promise<never>(() => {}));

    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
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
  it("titles each row of a currency: incomes, expenses, remainders and balances", () => {
    renderSummary([ARS]);

    const section = within(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    );
    const titles = section
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Ingresos", "Gastos", "Remanentes", "Saldos"]);
  });

  it("shows the incomes as total, collected and still to collect", () => {
    renderSummary([ARS]);

    const incomes = row("Ingresos en ARS");

    expect(card(incomes, "Total")).toHaveTextContent("$ 1.400,00");
    expect(card(incomes, "Cobrado")).toHaveTextContent("$ 1.000,00");
    expect(card(incomes, "Por cobrar")).toHaveTextContent("$ 400,00");
  });

  it("shows what is still expected back as one more card of the incomes row, with what it means", () => {
    renderSummary([ARS, USD]);

    const reimbursements = card(
      row("Ingresos en ARS"),
      "Reintegros pendientes",
    );

    expect(reimbursements).toHaveTextContent("$ 40,00");
    expect(reimbursements).toHaveTextContent(
      "Lo que esperás que te devuelvan y todavía no registraste como ingreso.",
    );
    expect(
      card(row("Ingresos en USD"), "Reintegros pendientes"),
    ).toHaveTextContent("US$ 0,00");
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
    expect(section.getByRole("heading", { name: "Saldos" })).toHaveAttribute(
      "data-tone",
      "balance",
    );
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
    expect(current).toHaveTextContent(
      "Saldo previo más lo cobrado menos lo pagado, en cuentas.",
    );
    expect(target).toHaveTextContent("terminaría el mes");
  });

  it("puts the balances after the remainders", () => {
    renderSummary([ARS]);

    const lists = within(screen.getByRole("region", { name: "Resumen en ARS" }))
      .getAllByRole("list")
      .map((list) => list.getAttribute("aria-label"));

    expect(lists).toEqual([
      "Ingresos en ARS",
      "Gastos en ARS",
      "Remanentes en ARS",
      "Saldos en ARS",
    ]);
  });

  it("shows the balances as previous, wallet and total available, in that order", () => {
    renderSummary([ARS]);

    const balances = row("Saldos en ARS");
    const labels = balances
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span")?.textContent);

    expect(labels).toEqual(["Saldo previo", "Billetera", "Total disponible"]);
    expect(card(balances, "Saldo previo")).toHaveTextContent("$ 5.000,00");
    expect(card(balances, "Billetera")).toHaveTextContent("$ 250,00");
    expect(card(balances, "Total disponible")).toHaveTextContent("$ 950,00");
  });

  it("explains each balance", () => {
    renderSummary([ARS]);

    const balances = row("Saldos en ARS");

    expect(card(balances, "Saldo previo")).toHaveTextContent(
      "Lo que quedó de los meses anteriores, en cuentas.",
    );
    expect(card(balances, "Billetera")).toHaveTextContent(
      "El efectivo que tenés en mano.",
    );
    expect(card(balances, "Total disponible")).toHaveTextContent(
      "Remanente actual más billetera: lo que tenés hoy.",
    );
  });

  it("makes only the total available stand out among the balances", () => {
    renderSummary([ARS]);

    const balances = row("Saldos en ARS");

    expect(card(balances, "Total disponible")).toHaveAttribute(
      "data-emphasis",
      "true",
    );
    expect(card(balances, "Saldo previo")).not.toHaveAttribute("data-emphasis");
    expect(card(balances, "Billetera")).not.toHaveAttribute("data-emphasis");
  });

  it("keeps each currency's balances apart", () => {
    renderSummary([ARS, USD]);

    expect(card(row("Saldos en USD"), "Billetera")).toHaveTextContent(
      "US$ 0,00",
    );
    expect(card(row("Saldos en ARS"), "Billetera")).not.toHaveTextContent(
      "US$",
    );
  });
});

describe("Summary with nothing in the month", () => {
  it("still shows the cards, at zero in the default currency", () => {
    renderSummary([]);

    expect(
      screen.getByRole("heading", { level: 2, name: "ARS" }),
    ).toBeInTheDocument();
    expect(card(row("Remanentes en ARS"), "Actual")).toHaveTextContent(/0,00/);
    expect(card(row("Saldos en ARS"), "Total disponible")).toHaveTextContent(
      /0,00/,
    );
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
    expect(loading.getByRole("heading", { name: "Saldos" })).toHaveAttribute(
      "data-tone",
      "balance",
    );
  });

  it("is made of the same rows as the real section, in the same order", () => {
    renderSummary(pending);

    const titles = within(
      screen.getByRole("region", { name: "Cargando resumen" }),
    )
      .getAllByRole("heading", { level: 3 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Ingresos", "Gastos", "Remanentes", "Saldos"]);
  });

  it("already names the balance cards and says what they mean, while their amounts wait", () => {
    renderSummary(pending);

    const loading = within(
      screen.getByRole("region", { name: "Cargando resumen" }),
    );

    expect(loading.getByText("Saldo previo")).toBeInTheDocument();
    expect(loading.getByText("Billetera")).toBeInTheDocument();
    expect(loading.getByText("Total disponible")).toBeInTheDocument();
    expect(
      loading.getByText("El efectivo que tenés en mano."),
    ).toBeInTheDocument();
  });

  it("shows skeleton cards, and no amount that could be taken for a real one", () => {
    const { container } = renderSummary(pending);

    expect(
      container.querySelectorAll(".skeleton").length,
    ).toBeGreaterThanOrEqual(11);
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
