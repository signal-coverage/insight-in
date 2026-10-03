// @vitest-environment jsdom
import { act, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { Conversions } from "./Conversions";
import type { ConversionsProps, ConversionsView, PairView } from "./types";

const INCOME_PAIR: PairView = {
  id: "USDC → ARS",
  side: "income",
  originCurrency: "USDC",
  count: "2",
  totalOrigin: "1.500,00 USDC",
  totalNet: "$ 1.860.000,00",
  averageRate: "$ 1.240,00",
  best: { rate: "$ 1.320,00", date: "20 sept 2026" },
  worst: { rate: "$ 1.200,00", date: "5 sept 2026" },
  last: { rate: "$ 1.320,00", date: "20 sept 2026" },
  items: [
    {
      id: "b",
      date: "20 sept 2026",
      description: "Extra",
      origin: "500,00 USDC",
      net: "$ 660.000,00",
      rate: "$ 1.320,00",
    },
    {
      id: "a",
      date: "5 sept 2026",
      description: "Sueldo",
      origin: "1.000,00 USDC",
      net: "$ 1.200.000,00",
      rate: "$ 1.200,00",
    },
  ],
};

const TETHER_PAIR: PairView = {
  ...INCOME_PAIR,
  id: "USDT → ARS",
  originCurrency: "USDT",
  count: "1",
  totalOrigin: "300,00 USDT",
  totalNet: "$ 360.000,00",
  items: [
    {
      id: "t",
      date: "7 sept 2026",
      description: "Freelance",
      origin: "300,00 USDT",
      net: "$ 360.000,00",
      rate: "$ 1.200,00",
    },
  ],
};

const EXPENSE_PAIR: PairView = {
  id: "ARS → USD",
  side: "expense",
  originCurrency: "USD",
  count: "1",
  totalOrigin: "US$ 20,00",
  totalNet: "$ 35.000,00",
  averageRate: "$ 1.750,00",
  best: { rate: "$ 1.750,00", date: "5 sept 2026" },
  worst: { rate: "$ 1.750,00", date: "5 sept 2026" },
  last: { rate: "$ 1.750,00", date: "5 sept 2026" },
  items: [
    {
      id: "e",
      date: "5 sept 2026",
      description: "Suscripción",
      origin: "US$ 20,00",
      net: "$ 35.000,00",
      rate: "$ 1.750,00",
    },
  ],
};

const VIEW: ConversionsView = {
  incomes: [INCOME_PAIR],
  expenses: [EXPENSE_PAIR],
  evolution: [
    {
      id: "income:USDC → ARS",
      side: "income",
      pair: "USDC → ARS",
      rows: [
        { month: "Agosto de 2026", rate: "$ 1.100,00", variation: "—" },
        {
          month: "Septiembre de 2026",
          rate: "$ 1.240,00",
          variation: "+12,7 %",
        },
      ],
    },
  ],
};

const NOTHING: ConversionsView = { incomes: [], expenses: [], evolution: [] };

const renderPage = (
  conversions: ConversionsProps["conversions"],
  month = "2026-09",
) =>
  render(
    <Conversions
      month={month}
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      conversions={conversions}
    />,
  );

const region = (name: string) => within(screen.getByRole("region", { name }));
// The table's headers repeat two of the labels, so the card is looked up inside the cards' list.
const card = (scope: ReturnType<typeof region>, label: string) =>
  within(scope.getByRole("list")).getByText(label).closest("li") as HTMLElement;

describe("Conversions header", () => {
  it("names the page and the month it is about", () => {
    renderPage(VIEW);

    expect(
      screen.getByRole("heading", { level: 1, name: "Conversiones" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).getByText("Septiembre de 2026"),
    ).toBeInTheDocument();
  });

  it("has the month selector in its header", () => {
    renderPage(VIEW, "2026-03");

    const selector = within(screen.getByRole("navigation", { name: "Mes" }));

    expect(selector.getByText("Septiembre de 2026")).toBeInTheDocument();
    expect(
      selector.getByRole("button", { name: "Mes anterior" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mes actual" }),
    ).toBeInTheDocument();
  });

  it("shows the selector while the content is loading, so the month can be changed meanwhile", () => {
    renderPage(new Promise<never>(() => {}));

    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
  });
});

describe("Conversions received", () => {
  it("has a section for the incomes with a pair heading inside it", () => {
    renderPage(VIEW);

    expect(
      screen.getByRole("heading", { level: 2, name: "Conversiones recibidas" }),
    ).toBeInTheDocument();
    expect(
      region("Conversiones recibidas").getByRole("heading", {
        level: 3,
        name: "USDC → ARS",
      }),
    ).toBeInTheDocument();
  });

  it("shows what was sent in the origin currency and what arrived in the net one", () => {
    renderPage(VIEW);

    const pair = region("USDC → ARS");

    expect(card(pair, "Conversiones")).toHaveTextContent("2");
    expect(card(pair, "Origen enviado")).toHaveTextContent("1.500,00 USDC");
    expect(card(pair, "Neto recibido")).toHaveTextContent("$ 1.860.000,00");
    expect(card(pair, "Neto recibido")).not.toHaveTextContent("USDC");
  });

  it("shows the weighted rate, the best and worst of the month with their dates, and the last one", () => {
    renderPage(VIEW);

    const pair = region("USDC → ARS");

    expect(card(pair, "Cotización promedio")).toHaveTextContent("$ 1.240,00");
    expect(card(pair, "Mejor cotización")).toHaveTextContent("$ 1.320,00");
    expect(card(pair, "Mejor cotización")).toHaveTextContent("20 sept 2026");
    expect(card(pair, "Peor cotización")).toHaveTextContent("$ 1.200,00");
    expect(card(pair, "Peor cotización")).toHaveTextContent("5 sept 2026");
    expect(card(pair, "Última cotización")).toHaveTextContent("$ 1.320,00");
  });

  it("lists each conversion of the month in a table, with its own rate", () => {
    renderPage(VIEW);

    const table = within(
      screen.getByRole("grid", { name: "Conversiones de USDC → ARS" }),
    );

    expect(
      table.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual([
      "Fecha",
      "Descripción",
      "Origen enviado",
      "Neto recibido",
      "Cotización",
    ]);

    const rows = table.getAllByRole("row").slice(1);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("20 sept 2026");
    expect(rows[0]).toHaveTextContent("Extra");
    expect(rows[0]).toHaveTextContent("500,00 USDC");
    expect(rows[0]).toHaveTextContent("$ 660.000,00");
    expect(rows[0]).toHaveTextContent("$ 1.320,00");
    expect(rows[1]).toHaveTextContent("Sueldo");
  });

  it("gives every pair a section of its own, so their figures never mix", () => {
    renderPage({ ...VIEW, incomes: [INCOME_PAIR, TETHER_PAIR] });

    expect(card(region("USDC → ARS"), "Origen enviado")).toHaveTextContent(
      "1.500,00 USDC",
    );
    expect(card(region("USDT → ARS"), "Origen enviado")).toHaveTextContent(
      "300,00 USDT",
    );
    expect(card(region("USDT → ARS"), "Origen enviado")).not.toHaveTextContent(
      "USDC",
    );
  });

  it("is left out when the month has none", () => {
    renderPage({ ...VIEW, incomes: [] });

    expect(
      screen.queryByRole("heading", { name: "Conversiones recibidas" }),
    ).not.toBeInTheDocument();
  });
});

describe("Purchases in another currency", () => {
  it("has a section for the expenses, labelled for what was paid and what the price said", () => {
    renderPage(VIEW);

    expect(
      screen.getByRole("heading", { level: 2, name: "Compras en otra moneda" }),
    ).toBeInTheDocument();

    const pair = region("ARS → USD");

    expect(card(pair, "Compras")).toHaveTextContent("1");
    expect(card(pair, "Precio de origen")).toHaveTextContent("US$ 20,00");
    expect(card(pair, "Pagado")).toHaveTextContent("$ 35.000,00");
    expect(card(pair, "Cotización promedio")).toHaveTextContent("$ 1.750,00");
  });

  it("tells the two sides apart by colour, not just by words", () => {
    renderPage(VIEW);

    expect(card(region("USDC → ARS"), "Neto recibido")).toHaveAttribute(
      "data-tone",
      "income",
    );
    expect(card(region("ARS → USD"), "Pagado")).toHaveAttribute(
      "data-tone",
      "expense",
    );
  });

  it("is left out when the month has none", () => {
    renderPage({ ...VIEW, expenses: [] });

    expect(
      screen.queryByRole("heading", { name: "Compras en otra moneda" }),
    ).not.toBeInTheDocument();
  });
});

describe("Rate evolution", () => {
  it("shows a table per pair with the month, the rate and the variation", () => {
    renderPage(VIEW);

    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Evolución de la cotización",
      }),
    ).toBeInTheDocument();

    const table = within(
      screen.getByRole("grid", {
        name: "Evolución de la cotización USDC → ARS",
      }),
    );

    expect(
      table.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Mes", "Cotización", "Variación"]);

    const rows = table.getAllByRole("row").slice(1);

    expect(rows[0]).toHaveTextContent("Agosto de 2026");
    expect(rows[0]).toHaveTextContent("—");
    expect(rows[1]).toHaveTextContent("$ 1.240,00");
    expect(rows[1]).toHaveTextContent("+12,7 %");
  });

  it("says which side each pair belongs to", () => {
    renderPage({
      ...VIEW,
      evolution: [
        ...VIEW.evolution,
        {
          ...VIEW.evolution[0],
          id: "expense:ARS → USD",
          side: "expense",
          pair: "ARS → USD",
        },
      ],
    });

    expect(
      screen.getByRole("heading", { level: 3, name: "Ingresos · USDC → ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Gastos · ARS → USD" }),
    ).toBeInTheDocument();
  });

  it("is left out when no pair has data in the last months", () => {
    renderPage({ ...VIEW, evolution: [] });

    expect(
      screen.queryByRole("heading", { name: "Evolución de la cotización" }),
    ).not.toBeInTheDocument();
  });
});

describe("Conversions with nothing in the month", () => {
  it("says so and points at where the origin is loaded", () => {
    renderPage(NOTHING);

    expect(
      screen.getByText("No hay conversiones este mes"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Cargá el monto de origen al registrar un ingreso o un gasto.",
      ),
    ).toBeInTheDocument();
  });

  it("shows neither of the blocks", () => {
    renderPage(NOTHING);

    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
  });

  it("keeps the evolution when earlier months have data", () => {
    renderPage({ ...NOTHING, evolution: VIEW.evolution });

    expect(
      screen.getByText("No hay conversiones este mes"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Evolución de la cotización" }),
    ).toBeInTheDocument();
  });

  it("does not show the empty message when there is something to show", () => {
    renderPage(VIEW);

    expect(
      screen.queryByText("No hay conversiones este mes"),
    ).not.toBeInTheDocument();
  });
});

describe("Conversions while loading", () => {
  const pending = new Promise<never>(() => {});

  it("renders the header at once and a placeholder where the content will be", () => {
    renderPage(pending);

    expect(
      screen.getByRole("heading", { level: 1, name: "Conversiones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Cargando conversiones" }),
    ).toHaveAttribute("aria-busy", "true");
  });

  it("already names what each side shows, with no figure that could be taken for a real one", () => {
    const { container } = renderPage(pending);
    const loading = region("Cargando conversiones");

    expect(
      loading.getByRole("heading", { name: "Conversiones recibidas" }),
    ).toBeInTheDocument();
    expect(
      loading.getByRole("heading", { name: "Compras en otra moneda" }),
    ).toBeInTheDocument();
    expect(loading.getAllByText("Cotización promedio")).toHaveLength(2);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("region", { name: "Cargando conversiones" }),
    ).not.toHaveTextContent(/\d/);
  });

  it("swaps the placeholder for the real content once it arrives", async () => {
    await act(async () => {
      renderPage(Promise.resolve(VIEW));
    });

    expect(
      await screen.findByRole("heading", { name: "Conversiones recibidas" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".skeleton")).toBeNull();
  });
});
