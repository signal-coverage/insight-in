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
vi.mock("@/core/settings/actions", () => ({
  saveHiddenSummaryCurrenciesAction: vi.fn(),
}));

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

import type { BlockResult, CurrencyChartsRow, SummaryRow } from "../../types";
import { MonthSection } from "./MonthSection";
import type { MonthSectionProps } from "./types";

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

const USDC: SummaryRow = { ...USD, currency: "USDC", current: "1,50 USDC" };

const USD_CHARTS: CurrencyChartsRow = {
  currency: "USD",
  monthly: [
    {
      month: "2026-09",
      monthLabel: "sep 26",
      incomes: 5000,
      expenses: 0,
      incomesLabel: "US$ 50,00",
      expensesLabel: "US$ 0,00",
    },
  ],
  categories: [],
  daily: [],
};

const CHARTS_OK: BlockResult<readonly CurrencyChartsRow[]> = {
  status: "ok",
  value: [USD_CHARTS],
};

const originalReplaceState = window.history.replaceState.bind(window.history);

// The address bar moves (a link, the back button): the router tells the page about it.
const navigate = (url: string) =>
  act(() => {
    window.history.replaceState(null, "", url);
  });

// `currencyParam` is not a prop: the block reads the currency from the address, so it sets the address.
const renderMonth = ({
  currencyParam,
  sectionParam,
  ...patch
}: Partial<MonthSectionProps> & {
  currencyParam?: string;
  sectionParam?: string;
} = {}) => {
  // The block reads the currency from the address, so the address starts as the test describes it.
  const params = new URLSearchParams();

  if ((patch.month ?? "2026-09") !== "2026-09") {
    params.set("month", patch.month ?? "");
  }
  if (currencyParam) params.set("currency", currencyParam);
  if (sectionParam) params.set("section", sectionParam);
  originalReplaceState(
    null,
    "",
    params.size > 0 ? `/dashboard/overview?${params}` : "/dashboard/overview",
  );

  return render(
    <MonthSection
      view="month"
      month="2026-09"
      currentMonth="2026-09"
      monthLabel="Septiembre de 2026"
      summary={[ARS, USD, USDC]}
      hiddenCurrencies={[]}
      charts={CHARTS_OK}
      aside={<button type="button">Saldo inicial</button>}
      controls={<p>Interruptor</p>}
      {...patch}
    />,
  );
};

const tab = (name: string) => screen.getByRole("tab", { name });

beforeEach(() => {
  router.push.mockClear();
  originalReplaceState(null, "", "/dashboard/overview");
  window.history.replaceState = (data, unused, url) => {
    originalReplaceState(data, unused, url);
    address.listeners.forEach((listener) => listener());
  };
});

afterEach(() => {
  window.history.replaceState = originalReplaceState;
});

describe("MonthSection", () => {
  it("is the month block, with its heading, the month selector, the side controls and the controls under them", () => {
    renderMonth();

    const block = screen.getByRole("region", { name: "El mes en detalle" });

    expect(
      within(block).getByRole("navigation", { name: "Mes" }),
    ).toHaveTextContent("Septiembre de 2026");
    expect(
      within(block).getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(
      within(block)
        .getByText("Interruptor")
        .compareDocumentPosition(within(block).getByRole("tablist")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("has one tab per currency, in the order given, ARS selected by default", () => {
    renderMonth();

    const tabs = within(
      screen.getByRole("tablist", { name: "Moneda" }),
    ).getAllByRole("tab");

    expect(tabs.map((each) => each.textContent)).toEqual([
      "ARS",
      "USD",
      "USDC",
    ]);
    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en USD" }),
    ).not.toBeInTheDocument();
  });

  it("opens the tab the address asks for", () => {
    renderMonth({ currencyParam: "USD" });

    expect(tab("USD")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
  });

  it("falls back to the first tab for a currency the user has no tab for", () => {
    renderMonth({ currencyParam: "XYZ" });

    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    expect(tab("USD")).toHaveAttribute("aria-selected", "false");
  });

  it("switches currency without leaving the page, and writes it in the address", () => {
    renderMonth();

    fireEvent.click(tab("USDC"));

    expect(
      screen.getByRole("region", { name: "Resumen en USDC" }),
    ).toBeInTheDocument();
    expect(window.location.search).toBe("?currency=USDC");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("leaves ARS out of the address, and keeps the month in it", () => {
    renderMonth({ month: "2026-08", currencyParam: "USD" });

    fireEvent.click(tab("ARS"));

    expect(window.location.search).toBe("?month=2026-08");
  });

  it("keeps the chosen currency when the month changes", () => {
    renderMonth();

    fireEvent.click(tab("USD"));
    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-08&currency=USD",
    );
  });

  it("shows the 6-month chart of the selected currency only, in the history view", () => {
    renderMonth({ view: "history", currencyParam: "USD" });

    expect(
      screen.getByLabelText("sep 26: ingresos US$ 50,00, gastos US$ 0,00"),
    ).toBeInTheDocument();

    fireEvent.click(tab("ARS"));

    expect(
      screen.queryByLabelText("sep 26: ingresos US$ 50,00, gastos US$ 0,00"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Todavía no hay ingresos ni gastos en estos meses."),
    ).toBeInTheDocument();
  });

  it("an error in the charts leaves the rest of the history block on screen, with a way to try again", () => {
    renderMonth({
      view: "history",
      currencyParam: "USD",
      charts: { status: "error" },
    });

    expect(screen.getByRole("tablist", { name: "Moneda" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?currency=USD",
    );
  });

  it("keeps the month and the currency in the address a retry goes back to", () => {
    renderMonth({
      view: "history",
      month: "2026-08",
      currencyParam: "USD",
      charts: { status: "error" },
    });

    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?month=2026-08&currency=USD",
    );
  });

  it("moves between the tabs with the arrow keys", () => {
    renderMonth();

    tab("ARS").focus();
    fireEvent.keyDown(tab("ARS"), { key: "ArrowRight" });

    expect(tab("USD")).toHaveAttribute("aria-selected", "true");
    expect(tab("ARS")).toHaveAttribute("aria-selected", "false");
    expect(window.location.search).toBe("?currency=USD");
  });

  describe("follows the address", () => {
    it("re-selects the tab when the address changes its currency", () => {
      renderMonth();
      expect(tab("ARS")).toHaveAttribute("aria-selected", "true");

      navigate("/dashboard/overview?currency=USD");

      expect(tab("USD")).toHaveAttribute("aria-selected", "true");
      expect(tab("ARS")).toHaveAttribute("aria-selected", "false");
    });

    it("keeps the tab while the address keeps its currency", () => {
      renderMonth({ currencyParam: "USD" });

      navigate("/dashboard/overview?month=2026-09&currency=USD");

      expect(tab("USD")).toHaveAttribute("aria-selected", "true");
    });

    it("goes back to the first tab when the address becomes bare", () => {
      renderMonth({
        view: "history",
        currencyParam: "USD",
        charts: { status: "error" },
      });
      expect(tab("USD")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
        "href",
        "/dashboard/overview?currency=USD",
      );

      navigate("/dashboard/overview");

      expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
      expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
        "href",
        "/dashboard/overview",
      );
    });

    it("falls back to the first tab for a currency without a tab", () => {
      renderMonth({ currencyParam: "USD" });

      navigate("/dashboard/overview?currency=xyz");

      expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    });

    it("reads the currency case-insensitively", () => {
      renderMonth();

      navigate("/dashboard/overview?currency=usd");

      expect(tab("USD")).toHaveAttribute("aria-selected", "true");
    });

    it("builds the month selector and the retry link from the address, not from an old pick", () => {
      renderMonth({ view: "history", charts: { status: "error" } });
      fireEvent.click(tab("USD"));
      navigate("/dashboard/overview");

      fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

      expect(router.push).toHaveBeenCalledWith(
        "/dashboard/overview?month=2026-08",
      );
      expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
        "href",
        "/dashboard/overview",
      );
    });
  });

  it("keeps the other parameters and the hash of the address when a tab is picked", () => {
    renderMonth({ currencyParam: "USD" });
    navigate("/dashboard/overview?currency=USD&status=PLANNED#detalle");

    fireEvent.click(tab("ARS"));

    expect(window.location.search).toBe("?status=PLANNED");
    expect(window.location.hash).toBe("#detalle");

    fireEvent.click(tab("USDC"));

    expect(window.location.search).toBe("?status=PLANNED&currency=USDC");
    expect(window.location.hash).toBe("#detalle");
  });

  it("shows the loading figures while the month's numbers are on their way, and the controls already", () => {
    renderMonth({ summary: new Promise<never>(() => {}) });

    expect(
      screen.getByRole("region", { name: "Cargando resumen" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
    expect(screen.getByText("Interruptor")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();
  });

  it("swaps the loading figures for the tabs once the numbers are there", async () => {
    // Resolved before it renders, inside act: the case jsdom can actually drive (see Await.test).
    const arrived = Promise.resolve([ARS]);

    await act(async () => {
      renderMonth({ summary: arrived });
    });

    expect(
      await screen.findByRole("tablist", { name: "Moneda" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Cargando resumen" }),
    ).not.toBeInTheDocument();
  });

  it("shows ARS at zero when the month brings no row at all", () => {
    renderMonth({ summary: [] });

    expect(tab("ARS")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toHaveTextContent(/0,00/);
  });
});

describe("MonthSection hidden currencies", () => {
  const tabNames = () =>
    within(screen.getByRole("tablist", { name: "Moneda" }))
      .getAllByRole("tab")
      .map((each) => each.textContent);

  it("has no tab and no panel for a hidden currency, and keeps the others in order", () => {
    renderMonth({ hiddenCurrencies: ["USD"] });

    expect(tabNames()).toEqual(["ARS", "USDC"]);
    expect(screen.queryByRole("tab", { name: "USD" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Resumen en ARS" }),
    ).toBeInTheDocument();

    fireEvent.click(tab("USDC"));

    expect(
      screen.getByRole("region", { name: "Resumen en USDC" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en USD" }),
    ).not.toBeInTheDocument();
  });

  it("brings the tab back when the currency is no longer hidden", () => {
    const { rerender } = renderMonth({ hiddenCurrencies: ["USD"] });

    expect(tabNames()).toEqual(["ARS", "USDC"]);

    rerender(
      <MonthSection
        view="month"
        month="2026-09"
        currentMonth="2026-09"
        monthLabel="Septiembre de 2026"
        summary={[ARS, USD, USDC]}
        hiddenCurrencies={[]}
        charts={CHARTS_OK}
      />,
    );

    expect(tabNames()).toEqual(["ARS", "USD", "USDC"]);
  });

  it("falls back to the first visible tab when the address asks for a hidden currency", () => {
    renderMonth({ hiddenCurrencies: ["ARS", "USD"], currencyParam: "USD" });

    expect(tabNames()).toEqual(["USDC"]);
    expect(tab("USDC")).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("region", { name: "Resumen en USDC" }),
    ).toBeInTheDocument();
  });

  it("still opens a visible currency the address asks for", () => {
    renderMonth({ hiddenCurrencies: ["ARS"], currencyParam: "USDC" });

    expect(tabNames()).toEqual(["USD", "USDC"]);
    expect(tab("USDC")).toHaveAttribute("aria-selected", "true");
  });

  it("shows every tab when stale data hides them all", () => {
    renderMonth({ hiddenCurrencies: ["ARS", "USD", "USDC"] });

    expect(tabNames()).toEqual(["ARS", "USD", "USDC"]);
  });

  it("waits for the hidden list, then shows the tabs without the hidden ones", async () => {
    const arrived = Promise.resolve(["USD"]);

    await act(async () => {
      renderMonth({ hiddenCurrencies: arrived });
    });

    expect(
      await screen.findByRole("tablist", { name: "Moneda" }),
    ).toBeVisible();
    expect(tabNames()).toEqual(["ARS", "USDC"]);
  });

  it("offers the currency picker beside the tabs, listing every currency the user has, hidden ones included", async () => {
    renderMonth({ hiddenCurrencies: ["USD"] });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Elegir monedas" }));
    });

    const boxes = screen.getAllByRole("checkbox");

    expect(boxes.map((each) => each.closest("label")?.textContent)).toEqual([
      expect.stringMatching(/^ARS - /),
      expect.stringMatching(/^USD - /),
      "USDC - USD Coin",
    ]);
    expect(boxes.map((each) => (each as HTMLInputElement).checked)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("has no picker when there is only one currency, nothing to choose", () => {
    const { unmount } = renderMonth({ summary: [ARS] });

    expect(
      screen.queryByRole("button", { name: "Elegir monedas" }),
    ).not.toBeInTheDocument();

    unmount();
    renderMonth({ summary: [ARS, USD] });

    expect(
      screen.getByRole("button", { name: "Elegir monedas" }),
    ).toBeInTheDocument();
  });

  it("has no picker for the zero row shown when the month brings nothing", () => {
    renderMonth({ summary: [] });

    expect(
      screen.queryByRole("button", { name: "Elegir monedas" }),
    ).not.toBeInTheDocument();
  });
});

const USD_DETAIL_CHARTS: BlockResult<readonly CurrencyChartsRow[]> = {
  status: "ok",
  value: [
    {
      ...USD_CHARTS,
      categories: [
        {
          key: "cat_food",
          name: "Comida",
          amount: 300,
          amountLabel: "US$ 3,00",
          shareLabel: "100 %",
          isOther: false,
        },
      ],
    },
  ],
};

describe("MonthSection in the month view", () => {
  it("draws the figures of the currency and no chart at all", () => {
    renderMonth({ currencyParam: "USD", charts: USD_DETAIL_CHARTS });

    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
    for (const title of [
      "Ingresos y gastos de los últimos 6 meses",
      "Gastos por categoría",
      "Saldo día a día",
    ]) {
      expect(
        screen.queryByRole("heading", { name: title }),
      ).not.toBeInTheDocument();
    }
  });

  it("does not wait for the charts, nor show their error, even when they fail", () => {
    renderMonth({ currencyParam: "USD", charts: { status: "error" } });

    expect(
      screen.getByRole("region", { name: "Resumen en USD" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the section in the address when a currency tab is picked", () => {
    renderMonth({ sectionParam: "month" });

    fireEvent.click(tab("USD"));

    expect(window.location.search).toBe("?section=month&currency=USD");
  });

  it("carries the section and the currency to the month selector", () => {
    renderMonth({ sectionParam: "month", currencyParam: "USD" });

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-08&currency=USD&section=month",
    );
  });
});

describe("MonthSection in the history view", () => {
  const renderHistory = (
    patch: Partial<MonthSectionProps> & {
      currencyParam?: string;
      sectionParam?: string;
    } = {},
  ) =>
    renderMonth({
      view: "history",
      aside: undefined,
      controls: undefined,
      ...patch,
    });

  it("is the last-6-months block, with its own heading, the month selector and the currency tabs", () => {
    renderHistory();

    const block = screen.getByRole("region", { name: "Últimos 6 meses" });

    expect(
      within(block).getByRole("heading", { level: 2, name: "Últimos 6 meses" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "El mes en detalle" }),
    ).not.toBeInTheDocument();
    expect(
      within(block).getByRole("navigation", { name: "Mes" }),
    ).toHaveTextContent("Septiembre de 2026");
    expect(
      within(block).getByRole("tablist", { name: "Moneda" }),
    ).toBeInTheDocument();
  });

  it("renders no side button nor controls unless it is given them", () => {
    const { unmount } = renderHistory();

    expect(
      screen.queryByRole("button", { name: "Saldo inicial" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Interruptor")).not.toBeInTheDocument();

    unmount();
    renderHistory({
      aside: <button type="button">Saldo inicial</button>,
      controls: <p>Interruptor</p>,
    });

    expect(
      screen.getByRole("button", { name: "Saldo inicial" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Interruptor")).toBeInTheDocument();
  });

  it("shows the three charts of the selected currency, and no figures", () => {
    renderHistory({ currencyParam: "USD", charts: USD_DETAIL_CHARTS });

    expect(
      screen.getByLabelText("sep 26: ingresos US$ 50,00, gastos US$ 0,00"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Comida: US$ 3,00 (100 % del total)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Saldo día a día" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "Resumen en USD" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the currency tabs working and the section in the address", () => {
    renderHistory({ sectionParam: "history" });

    fireEvent.click(tab("USDC"));

    expect(tab("USDC")).toHaveAttribute("aria-selected", "true");
    expect(window.location.search).toBe("?section=history&currency=USDC");
  });

  it("carries the section and the currency to the month selector and the retry link", () => {
    renderHistory({
      sectionParam: "history",
      currencyParam: "USD",
      charts: { status: "error" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Mes anterior" }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/overview?month=2026-08&currency=USD&section=history",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar esto.",
    );
    expect(screen.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
      "href",
      "/dashboard/overview?currency=USD&section=history",
    );
  });

  it("shows a skeleton, not the month's loading figures, while the numbers are on their way", () => {
    const { container } = renderHistory({
      summary: new Promise<never>(() => {}),
    });

    expect(
      screen.queryByRole("region", { name: "Cargando resumen" }),
    ).not.toBeInTheDocument();
    expect(container.querySelector(".skeleton")).not.toBeNull();
    expect(screen.getByRole("navigation", { name: "Mes" })).toBeInTheDocument();
  });
});
