// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const address = vi.hoisted(() => ({
  listeners: new Set<() => void>(),
  subscribe(listener: () => void) {
    address.listeners.add(listener);

    return () => address.listeners.delete(listener);
  },
}));

// Like Next, useSearchParams follows the address bar, also when it is rewritten with replaceState.
vi.mock("next/navigation", async () => {
  const { useSyncExternalStore } = await import("react");

  return {
    useRouter: () => router,
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          address.subscribe,
          () => window.location.search,
          () => "",
        ),
      ),
  };
});
vi.mock("@/core/balances/actions", () => ({
  saveOpeningBalanceAction: vi.fn(),
}));
vi.mock("@/core/settings/actions", () => ({
  saveIncludeExpectedIncomesAction: vi.fn(),
  saveHiddenSummaryCurrenciesAction: vi.fn(),
}));

import { Summary } from "./Summary";
import type { OpeningBalanceData } from "./components/OpeningBalanceDrawer";
import type {
  AttentionGroupRow,
  CurrencyAccountsRow,
  SummaryRow,
} from "./types";

const OPENING: OpeningBalanceData = {
  month: "2026-06",
  groups: [
    {
      bankId: "bank_galicia",
      bankName: "Banco Galicia",
      rows: [
        {
          index: 0,
          accountId: "acc_bank",
          currency: "ARS",
          label: "Caja de ahorro (ARS)",
          amount: "5000.50",
        },
      ],
    },
  ],
};

const ARS: SummaryRow = {
  currency: "ARS",
  incomes: { total: "$ 1.400,00", settled: "$ 1.000,00", pending: "$ 400,00" },
  expenses: { total: "$ 500,00", settled: "$ 300,00", pending: "$ 200,00" },
  previous: "$ 5.000,00",
  current: "$ 700,00",
  target: "$ 900,00",
  reimbursements: "$ 40,00",
  paidPercent: 60,
};

const USD: SummaryRow = {
  currency: "USD",
  incomes: { total: "US$ 50,00", settled: "US$ 50,00", pending: "US$ 0,00" },
  expenses: { total: "US$ 0,00", settled: "US$ 0,00", pending: "US$ 0,00" },
  previous: "US$ 0,00",
  current: "US$ 50,00",
  target: "US$ 50,00",
  reimbursements: "US$ 0,00",
  paidPercent: 0,
};

const ACCOUNTS_ROW: CurrencyAccountsRow = {
  currency: "ARS",
  totalLabel: "$ 8.500,00",
  isTotalNegative: false,
  banks: [
    {
      bankId: "b1",
      bankName: "Galicia",
      accounts: [
        {
          accountId: "a1",
          name: "Caja de ahorro",
          balanceLabel: "$ 8.500,00",
          isNegative: false,
          isArchived: false,
        },
      ],
    },
  ],
};

const ATTENTION: AttentionGroupRow[] = [
  {
    kind: "negativeAccount",
    title: "Cuentas en negativo",
    linkLabel: "Ver Bancos",
    href: "/dashboard/banks",
    hiddenCount: 0,
    items: [
      {
        id: "a1",
        title: "Galicia · Caja de ahorro",
        amountLabel: "-$ 300,00",
        limitLabel: null,
        dateLabel: null,
        severity: "danger",
      },
    ],
  },
];

type SummaryTestProps = Parameters<typeof Summary>[0];

const originalReplaceState = window.history.replaceState.bind(window.history);

// The address the page was opened at, as the month block reads it.
const openAt = (url: string) => originalReplaceState(null, "", url);

beforeEach(() => {
  router.push.mockClear();
  openAt("/dashboard/overview");
  window.history.replaceState = (data, unused, url) => {
    originalReplaceState(data, unused, url);
    address.listeners.forEach((listener) => listener());
  };
});

afterEach(() => {
  window.history.replaceState = originalReplaceState;
});

const renderSummary = (
  summary: SummaryTestProps["summary"],
  month = "2026-09",
  openingBalance: SummaryTestProps["openingBalance"] = OPENING,
  includeExpectedIncomes: SummaryTestProps["includeExpectedIncomes"] = true,
  accountBalances: SummaryTestProps["accountBalances"] = [],
  extra: Partial<
    Pick<SummaryTestProps, "attention" | "charts" | "hiddenCurrencies">
  > = {},
) =>
  render(
    <Summary
      month={month}
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      summary={summary}
      openingBalance={openingBalance}
      includeExpectedIncomes={includeExpectedIncomes}
      hiddenCurrencies={extra.hiddenCurrencies ?? []}
      accountBalances={accountBalances}
      attention={extra.attention ?? { status: "ok", value: [] }}
      charts={extra.charts ?? { status: "ok", value: [] }}
    />,
  );

// The month in detail and the last six months are sections of their own (the address says which).
const MONTH_ADDRESS = "/dashboard/overview?section=month";
const HISTORY_ADDRESS = "/dashboard/overview?section=history";

const monthBlock = () =>
  within(screen.getByRole("region", { name: "El mes en detalle" }));

const showTab = (currency: string) =>
  fireEvent.click(screen.getByRole("tab", { name: currency }));

const row = (name: string) => within(screen.getByRole("list", { name }));
const card = (list: ReturnType<typeof row>, label: string) =>
  list.getByText(label).closest("li") as HTMLElement;

describe("Summary header", () => {
  beforeEach(() => openAt(MONTH_ADDRESS));

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

  it("has the month selector in the month block, with the month it is about", () => {
    renderSummary([ARS]);

    const selector = within(
      monthBlock().getByRole("navigation", { name: "Mes" }),
    );

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
  beforeEach(() => openAt(MONTH_ADDRESS));

  it("offers a Saldo inicial button in the month block, beside the month selector, and none in the page header", () => {
    renderSummary([ARS]);

    expect(
      monthBlock().getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(
      monthBlock().getByRole("navigation", { name: "Mes" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("banner")).queryByRole("button", {
        name: "Saldo inicial",
      }),
    ).not.toBeInTheDocument();
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
    expect(within(dialog).getByLabelText(/Caja de ahorro/)).toHaveValue(
      "5000.50",
    );
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
  beforeEach(() => openAt(MONTH_ADDRESS));

  const toggle = () =>
    screen.getByRole("switch", { name: /Sumar ingresos por cobrar/ });

  it("sits in the month block, under its heading and before the currency tabs", () => {
    renderSummary([ARS]);

    const header = screen.getByRole("banner");
    const tabs = screen.getByRole("tablist", { name: "Moneda" });

    expect(within(header).queryByRole("switch")).not.toBeInTheDocument();
    expect(monthBlock().getByRole("switch")).toBe(toggle());
    expect(
      monthBlock()
        .getByRole("heading", { level: 2, name: "El mes en detalle" })
        .compareDocumentPosition(toggle()) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      toggle().compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING,
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
  beforeEach(() => openAt(MONTH_ADDRESS));

  it("gives each currency a tab, and shows the selected one's section with its code as heading", () => {
    renderSummary([ARS, USD]);

    expect(screen.getByRole("tab", { name: "ARS" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    const heading = screen.getByRole("heading", { level: 3, name: "ARS" });

    expect(heading).toHaveClass("sr-only");
    expect(
      screen.queryByRole("heading", { level: 3, name: "USD" }),
    ).not.toBeInTheDocument();

    showTab("USD");

    expect(
      screen.getByRole("heading", { level: 3, name: "USD" }),
    ).toBeInTheDocument();
  });

  it("keeps the tabs in the order they come", () => {
    renderSummary([ARS, USD]);

    expect(
      within(screen.getByRole("tablist", { name: "Moneda" }))
        .getAllByRole("tab")
        .map((each) => each.textContent),
    ).toEqual(["ARS", "USD"]);
  });

  it("does not mix the amounts of different currencies", () => {
    renderSummary([ARS, USD]);

    expect(card(row("Remanentes en ARS"), "Actual")).not.toHaveTextContent(
      "US$",
    );

    showTab("USD");

    expect(card(row("Remanentes en USD"), "Actual")).toHaveTextContent(
      "US$ 50,00",
    );
  });

  it("opens the tab the address asks for", () => {
    openAt("/dashboard/overview?section=month&currency=USD");
    renderSummary([ARS, USD]);

    expect(screen.getByRole("tab", { name: "USD" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(card(row("Remanentes en USD"), "Actual")).toHaveTextContent(
      "US$ 50,00",
    );
  });
});

describe("Summary rows say what they are", () => {
  beforeEach(() => openAt(MONTH_ADDRESS));

  it("titles each row of a currency: incomes, expenses and remainders", () => {
    renderSummary([ARS]);

    const section = within(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    );
    const titles = section
      .getAllByRole("heading", { level: 4 })
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

    showTab("USD");

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
  });

  it("shows Saldo previo, Actual and Objetivo, in that order, and explains each one", () => {
    renderSummary([ARS]);

    const remainders = row("Remanentes en ARS");
    const labels = remainders
      .getAllByRole("listitem")
      .map((item) => item.querySelector("span")?.textContent);

    expect(labels).toEqual(["Saldo previo", "Actual", "Objetivo"]);
    expect(card(remainders, "Saldo previo")).toHaveTextContent("$ 5.000,00");
    expect(card(remainders, "Saldo previo")).toHaveTextContent(
      "Lo que sumaban tus cuentas al empezar el mes.",
    );
    expect(card(remainders, "Actual")).toHaveTextContent("$ 700,00");
    expect(card(remainders, "Actual")).toHaveTextContent(
      "Saldo previo más lo cobrado menos lo pagado en el mes, sumando todas tus cuentas.",
    );
    expect(card(remainders, "Objetivo")).toHaveTextContent("$ 900,00");
    expect(card(remainders, "Objetivo")).toHaveTextContent("terminaría el mes");
  });

  it("makes Actual and Objetivo stand out, not Saldo previo", () => {
    renderSummary([ARS]);

    const remainders = row("Remanentes en ARS");

    expect(card(remainders, "Actual")).toHaveAttribute("data-emphasis", "true");
    expect(card(remainders, "Objetivo")).toHaveAttribute(
      "data-emphasis",
      "true",
    );
    expect(card(remainders, "Saldo previo")).not.toHaveAttribute(
      "data-emphasis",
    );
  });

  it("has no Billetera nor Total disponible", () => {
    renderSummary([ARS]);

    expect(screen.queryByText("Billetera")).not.toBeInTheDocument();
    expect(screen.queryByText("Total disponible")).not.toBeInTheDocument();
  });
});

describe("Summary accounts section", () => {
  it("shows the 'Por cuenta' section at the top of the first section, under the section tabs, once its numbers arrive", () => {
    openAt("/dashboard/overview");
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW]);

    const accounts = screen.getByRole("heading", { name: "Por cuenta" });

    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("tablist", { name: "Secciones del resumen" })
        .compareDocumentPosition(accounts) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("keeps the shape of the page while the accounts load", () => {
    openAt("/dashboard/overview");
    renderSummary([ARS], "2026-09", OPENING, true, new Promise(() => {}));

    expect(screen.queryByRole("heading", { name: "Por cuenta" })).toBeNull();
    expect(
      screen.getByRole("heading", { name: "Resumen" }),
    ).toBeInTheDocument();
  });
});

describe("Summary with nothing in the month", () => {
  beforeEach(() => openAt(MONTH_ADDRESS));

  it("still shows the cards, at zero in the default currency", () => {
    renderSummary([]);

    expect(
      screen.getByRole("heading", { level: 3, name: "ARS" }),
    ).toBeInTheDocument();
    expect(card(row("Remanentes en ARS"), "Actual")).toHaveTextContent(/0,00/);
    expect(card(row("Remanentes en ARS"), "Saldo previo")).toHaveTextContent(
      /0,00/,
    );
  });
});

describe("Summary while the numbers are loading", () => {
  beforeEach(() => openAt(MONTH_ADDRESS));

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

  it("is made of the same rows as the real section, in the same order", () => {
    renderSummary(pending);

    const titles = within(
      screen.getByRole("region", { name: "Cargando resumen" }),
    )
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);

    expect(titles).toEqual(["Ingresos", "Gastos", "Remanentes"]);
  });

  it("already names the remainder cards and says what they mean, while their amounts wait", () => {
    renderSummary(pending);

    const loading = within(
      screen.getByRole("region", { name: "Cargando resumen" }),
    );

    expect(loading.getByText("Saldo previo")).toBeInTheDocument();
    expect(loading.getByText("Actual")).toBeInTheDocument();
    expect(loading.getByText("Objetivo")).toBeInTheDocument();
    expect(
      loading.getByText("Lo que sumaban tus cuentas al empezar el mes."),
    ).toBeInTheDocument();
  });

  it("shows skeleton cards, and no amount that could be taken for a real one", () => {
    const { container } = renderSummary(pending);

    expect(
      container.querySelectorAll(".skeleton").length,
    ).toBeGreaterThanOrEqual(10);
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
      await screen.findByRole("heading", { level: 3, name: "ARS" }),
    ).toBeInTheDocument();
    expect(document.querySelector(".skeleton")).toBeNull();
  });
});

describe("Summary attention block", () => {
  it("shows what needs attention right after 'Por cuenta', in the first section", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "ok", value: ATTENTION },
    });

    const heading = screen.getByRole("heading", {
      level: 2,
      name: "Requiere atención",
    });

    expect(
      screen
        .getByRole("heading", { name: "Por cuenta" })
        .compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      screen.queryByRole("region", { name: "El mes en detalle" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ver Bancos/ })).toHaveAttribute(
      "href",
      "/dashboard/banks",
    );
  });

  it("is not there when nothing needs attention, and the rest of the section is", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW]);

    expect(
      screen.queryByRole("heading", { name: "Requiere atención" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
  });

  it("shows a skeleton where it will be while it is read", () => {
    const { container } = renderSummary([ARS], "2026-09", OPENING, true, [], {
      attention: new Promise<never>(() => {}),
    });

    expect(container.querySelector(".skeleton")).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Requiere atención" }),
    ).not.toBeInTheDocument();
  });
});

describe("Summary when a block cannot be loaded", () => {
  it("an error in the attention block leaves the rest of the first section on screen", () => {
    openAt("/dashboard/overview");
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "error" },
      charts: { status: "error" },
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(
      screen.getByRole("link", { name: "Reintentar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
  });

  it("an error in the charts shows in the last 6 months section and leaves its selector on screen", () => {
    openAt(HISTORY_ADDRESS);
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "error" },
      charts: { status: "error" },
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
  });

  it("a failing charts block does not touch the month's figures: no error there", () => {
    openAt(MONTH_ADDRESS);
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "error" },
      charts: { status: "error" },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(card(row("Remanentes en ARS"), "Actual")).toHaveTextContent(
      "$ 700,00",
    );
  });

  it("retries at the address the page is at, with its month and currency (first section)", () => {
    openAt("/dashboard/overview?month=2026-08&currency=USD");
    renderSummary([ARS, USD], "2026-08", OPENING, true, [], {
      attention: { status: "error" },
      charts: { status: "error" },
    });

    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?month=2026-08&currency=USD",
    );
  });

  it("retries at the address the page is at, with its month, currency and the history section", () => {
    openAt("/dashboard/overview?month=2026-08&currency=USD&section=history");
    renderSummary([ARS, USD], "2026-08", OPENING, true, [], {
      charts: { status: "error" },
    });

    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?month=2026-08&currency=USD&section=history",
    );
  });

  it("shows no error when every block loads", () => {
    renderSummary([ARS], "2026-09", OPENING, true, [ACCOUNTS_ROW], {
      attention: { status: "ok", value: ATTENTION },
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Requiere atención" }),
    ).toBeInTheDocument();
  });
});

describe("Summary hidden currencies", () => {
  const USD_ACCOUNTS_ROW: CurrencyAccountsRow = {
    ...ACCOUNTS_ROW,
    currency: "USD",
    totalLabel: "US$ 120,00",
  };

  it.each([["month"], ["history"]])(
    "hides the tab of a hidden currency in the %s section",
    (section) => {
      openAt(`/dashboard/overview?section=${section}`);
      renderSummary(
        [ARS, USD],
        "2026-09",
        OPENING,
        true,
        [ACCOUNTS_ROW, USD_ACCOUNTS_ROW],
        { hiddenCurrencies: ["USD"] },
      );

      expect(
        within(screen.getByRole("tablist", { name: "Moneda" }))
          .getAllByRole("tab")
          .map((each) => each.textContent),
      ).toEqual(["ARS"]);
    },
  );

  it("keeps showing every currency in 'Por cuenta', hidden ones included", () => {
    renderSummary(
      [ARS, USD],
      "2026-09",
      OPENING,
      true,
      [ACCOUNTS_ROW, USD_ACCOUNTS_ROW],
      { hiddenCurrencies: ["USD"] },
    );

    expect(
      screen.getByRole("region", { name: "Por cuenta en USD" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
  });

  it("shows both tabs in the month section and 'Por cuenta' in the first when nothing is hidden", () => {
    openAt(MONTH_ADDRESS);
    renderSummary([ARS, USD], "2026-09", OPENING, true, [
      ACCOUNTS_ROW,
      USD_ACCOUNTS_ROW,
    ]);

    expect(screen.getByRole("tab", { name: "USD" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Por cuenta en USD" }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Cuentas y atención" }));

    expect(
      screen.getByRole("region", { name: "Por cuenta en USD" }),
    ).toBeInTheDocument();
  });
});

describe("Summary section tabs", () => {
  const MONTHLY = "Ingresos y gastos de los últimos 6 meses";
  const accounts = [ACCOUNTS_ROW];
  const withAttention = {
    attention: { status: "ok", value: ATTENTION },
  } as const;

  const renderFull = (url: string) => {
    openAt(url);

    return renderSummary(
      [ARS, USD],
      "2026-09",
      OPENING,
      true,
      accounts,
      withAttention,
    );
  };

  const sectionTab = (name: string) => screen.getByRole("tab", { name });
  const tabSelected = (name: string) =>
    screen.getByRole("tab", { name }).getAttribute("aria-selected") === "true";
  const sectionTabs = () =>
    within(screen.getByRole("tablist", { name: "Secciones del resumen" }));

  it("has the three sections, in order, under the page header", () => {
    renderFull("/dashboard/overview");

    expect(
      sectionTabs()
        .getAllByRole("tab")
        .map((each) => each.textContent),
    ).toEqual(["Cuentas y atención", "El mes en detalle", "Últimos 6 meses"]);
    expect(
      screen
        .getByRole("banner")
        .compareDocumentPosition(
          screen.getByRole("tablist", { name: "Secciones del resumen" }),
        ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("opens on the accounts and attention section: no month figures, no charts, no month selector", () => {
    renderFull("/dashboard/overview");

    expect(sectionTab("Cuentas y atención")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Requiere atención" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en ARS" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Gastos por categoría" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: MONTHLY }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Mes" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Saldo inicial" }),
    ).not.toBeInTheDocument();
  });

  it("shows the month in detail with its figures and no chart at all for ?section=month", () => {
    renderFull(MONTH_ADDRESS);

    expect(sectionTab("El mes en detalle")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "El mes en detalle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: /Sumar ingresos por cobrar/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    for (const title of [MONTHLY, "Gastos por categoría", "Saldo día a día"]) {
      expect(
        screen.queryByRole("heading", { name: title }),
      ).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole("region", { name: "Por cuenta en ARS" }),
    ).not.toBeInTheDocument();
  });

  it("shows the three charts, with the selector and the currency tabs, and no figures, for ?section=history", () => {
    renderFull(HISTORY_ADDRESS);

    expect(sectionTab("Últimos 6 meses")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Últimos 6 meses" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: MONTHLY })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByRole("tablist", { name: "Moneda" })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en ARS" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Saldo inicial" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gastos por categoría" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Saldo día a día" }),
    ).toBeInTheDocument();
  });

  it("falls back to the accounts and attention section for an unknown ?section=", () => {
    renderFull("/dashboard/overview?section=nope");

    expect(sectionTab("Cuentas y atención")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en ARS" }),
    ).not.toBeInTheDocument();
  });

  it("shows the content of the tab that is pressed and writes it in the address, keeping month and currency", () => {
    renderFull("/dashboard/overview?month=2026-08&currency=USD#detalle");

    fireEvent.click(sectionTab("El mes en detalle"));

    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe(
      "?month=2026-08&currency=USD&section=month",
    );
    expect(window.location.hash).toBe("#detalle");

    fireEvent.click(sectionTab("Últimos 6 meses"));

    expect(screen.getByRole("heading", { name: MONTHLY })).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en USD" }),
    ).not.toBeInTheDocument();
    expect(tabSelected("USD")).toBe(true);
    expect(window.location.search).toBe(
      "?month=2026-08&currency=USD&section=history",
    );

    fireEvent.click(sectionTab("Cuentas y atención"));

    expect(
      screen.getByRole("region", { name: "Por cuenta en ARS" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?month=2026-08&currency=USD");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps the section when a currency tab is picked", () => {
    renderFull(HISTORY_ADDRESS);

    showTab("USD");

    expect(window.location.search).toBe("?section=history&currency=USD");
    expect(screen.getByRole("heading", { name: MONTHLY })).toBeInTheDocument();
  });

  it("carries the section and the currency to the month selector's links", () => {
    renderFull("/dashboard/overview?currency=USD&section=history");

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-08&currency=USD&section=history",
    );
  });

  it("follows the address when it changes the section, like the back button does", () => {
    renderFull("/dashboard/overview");
    expect(sectionTab("Cuentas y atención")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    act(() => {
      window.history.replaceState(null, "", HISTORY_ADDRESS);
    });

    expect(sectionTab("Últimos 6 meses")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: MONTHLY })).toBeInTheDocument();
  });

  it("can still open the opening balance editor from the month section", async () => {
    renderFull(MONTH_ADDRESS);

    fireEvent.click(screen.getByRole("button", { name: "Saldo inicial" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("is narrow-screen friendly: the tab list stretches the full width, with a tab per section", () => {
    renderFull("/dashboard/overview");

    expect(
      screen.getByRole("tablist", { name: "Secciones del resumen" }),
    ).toHaveClass("w-full");
    for (const each of sectionTabs().getAllByRole("tab")) {
      expect(each).toHaveClass("flex-1");
    }
  });
});
