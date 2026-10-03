// @vitest-environment jsdom
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/installments/actions", () => ({
  createInstallmentPlanAction: vi.fn(),
  applyIncomeInstallmentCountsAction: vi.fn(),
}));
const actions = vi.hoisted(() => ({ setIncomeStatusAction: vi.fn() }));

vi.mock("@/core/incomes/actions", () => ({
  ...actions,
  createIncomeAction: vi.fn(),
  updateIncomeAction: vi.fn(),
  deleteIncomeAction: vi.fn(),
  deleteIncomesAction: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  createRecurringIncomeAction: vi.fn(),
  updateRecurringIncomeAction: vi.fn(),
  deleteRecurringIncomeAction: vi.fn(),
}));

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { Incomes } from "./Incomes";
import type { IncomeRow, RepaymentData } from "./types";

const ROW: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  medium: "DIGITAL",
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  status: "SETTLED",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "1 sept 2026",
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  reimbursesExpenseId: null,
  reimbursesExpenseDescription: null,
  reimbursementTooltip: null,
};

// Mid-month on purpose: the default range is the whole month, not the days up to today.
const TODAY = "2026-09-15";

// One loan repaid in installments, with one of its installments already in the month.
const REPAYMENTS: RepaymentData = {
  month: "2026-09",
  monthLabel: "Septiembre de 2026",
  plans: [
    {
      id: "plan_1",
      description: "Préstamo a Juan",
      categoryName: "Préstamos",
      currency: "ARS",
      totalCuotas: 12,
      doneCount: 3,
      pendingCount: 9,
      nextAmount: 10000000,
      defaultCount: 1,
      nextAmountLabel: "$ 100.000,00",
      progressLabel: "3 de 12 · quedan 9",
    },
  ],
};

const PAGINATION = { page: 1, totalPages: 1, total: 1, pageSize: 25 };

const renderIncomes = () =>
  render(
    <Incomes
      today={TODAY}
      query={DEFAULT_ENTRIES_QUERY}
      totals={[]}
      categories={[{ id: "c1", name: "Salary", count: 1 }]}
      currencies={["USD"]}
      table={{ rows: [ROW], pagination: PAGINATION, hasAnyIncomes: true }}
      recurring={[]}
      repayments={REPAYMENTS}
      reimbursables={[]}
    />,
  );

const renderEmptyIncomes = ({
  query = DEFAULT_ENTRIES_QUERY,
  currencies = [],
}: { query?: typeof DEFAULT_ENTRIES_QUERY; currencies?: string[] } = {}) =>
  render(
    <Incomes
      today={TODAY}
      query={query}
      totals={[]}
      categories={[{ id: "c1", name: "Salary", count: 0 }]}
      currencies={currencies}
      table={{
        rows: [],
        pagination: { ...PAGINATION, total: 0 },
        hasAnyIncomes: currencies.length > 0,
      }}
      recurring={[]}
      repayments={REPAYMENTS}
      reimbursables={[]}
    />,
  );

const CURRENT_MONTH = {
  ...DEFAULT_ENTRIES_QUERY,
  from: "2026-09-01",
  to: "2026-09-30",
};

const header = (container: HTMLElement) =>
  container.querySelector("header") as HTMLElement;

const trigger = () => screen.getByRole("button", { name: "Acciones" });

const openMenu = () => {
  fireEvent.keyDown(trigger(), { key: "ArrowDown" });

  return screen.findByRole("menu");
};

const choose = async (name: string) => {
  await openMenu();

  const item = screen.getByRole("menuitem", { name });

  fireEvent.keyDown(item, { key: "Enter" });
  fireEvent.keyUp(item, { key: "Enter" });
};

describe("Incomes while its data is still on the way", () => {
  const never = <T,>() => new Promise<T>(() => {});

  const renderPending = (query = CURRENT_MONTH) =>
    render(
      <Incomes
        today={TODAY}
        query={query}
        totals={never()}
        categories={never()}
        currencies={never()}
        table={never()}
        recurring={never()}
        repayments={never()}
        reimbursables={never()}
      />,
    );

  it("renders the structure of the page at once: title, Actions menu and every filter", () => {
    const { container } = renderPending();

    const filters = within(
      screen.getByRole("group", { name: "Filtrar ingresos" }),
    );

    expect(
      screen.getByRole("heading", { name: "Ingresos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones" }),
    ).toBeInTheDocument();
    // Scoped to the filter bar: the table already shows its own "Categoría" header too.
    ["Desde", "Hasta", "Categoría", "Moneda"].forEach((label) => {
      expect(filters.getByText(label)).toBeInTheDocument();
    });
    // Nothing in the header waits for data.
    expect(header(container).querySelector(".skeleton")).toBeNull();
  });

  it("shows a loading state only in the table, the totals and the two selects", () => {
    const { container } = renderPending();

    // The table: skeleton rows, announced as loading.
    expect(screen.getByRole("status", { name: "" })).toHaveTextContent(
      "Cargando ingresos",
    );
    // The totals: a busy placeholder card.
    expect(
      screen.getByRole("list", { name: "Total de ingresos por moneda" }),
    ).toHaveAttribute("aria-busy", "true");
    // The two selects: one skeleton each, and nothing else in the filter bar is busy.
    const filters = screen.getByRole("group", { name: "Filtrar ingresos" });

    expect(filters.querySelectorAll('[aria-busy="true"]')).toHaveLength(2);
    expect(header(container).querySelector('[aria-busy="true"]')).toBeNull();
  });

  it("already shows the default date range, which comes from the URL and not from the data", () => {
    renderPending(CURRENT_MONTH);

    const value = (name: string) =>
      (document.querySelector(`input[name="${name}"]`) as HTMLInputElement)
        .value;

    expect(value("from")).toBe("2026-09-01");
    expect(value("to")).toBe("2026-09-30");
  });

  it("does not claim the user has no incomes while it does not know yet", () => {
    renderPending();

    expect(
      screen.queryByText("Todavía no hay ingresos"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Ningún ingreso coincide con estos filtros"),
    ).not.toBeInTheDocument();
  });

  it("keeps the Actions menu working without waiting for any data", async () => {
    renderPending();

    fireEvent.keyDown(screen.getByRole("button", { name: "Acciones" }), {
      key: "ArrowDown",
    });

    const menu = await screen.findByRole("menu");

    expect(within(menu).getAllByRole("menuitem")).toHaveLength(6);
  });

  it("mounts the repayment drawers only once their data has arrived", async () => {
    renderPending();

    await choose("Devoluciones en cuotas");
    await choose("Devolución en cuotas");

    expect(
      screen.queryByRole("heading", { name: /Devoluciones? en cuotas de/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Paso 1 de 2 · Datos de la devolución"),
    ).not.toBeInTheDocument();
  });

  it("offers Clear filters from the URL alone when the view is not the default", () => {
    renderPending({ ...CURRENT_MONTH, currency: "USD" });

    expect(
      screen.getByRole("button", { name: "Limpiar filtros" }),
    ).toBeInTheDocument();
  });

  it("shows the loaded page once every piece has arrived", async () => {
    await act(async () => {
      render(
        <Incomes
          today={TODAY}
          query={DEFAULT_ENTRIES_QUERY}
          totals={Promise.resolve([
            {
              currency: "USD",
              label: "US$2,500.00",
              settled: "US$2,500.00",
              pending: "$0,00",
            },
          ])}
          categories={Promise.resolve([{ id: "c1", name: "Salary", count: 1 }])}
          currencies={Promise.resolve(["USD"])}
          table={Promise.resolve({
            rows: [ROW],
            pagination: PAGINATION,
            hasAnyIncomes: true,
          })}
          recurring={Promise.resolve([])}
          repayments={Promise.resolve(REPAYMENTS)}
          reimbursables={Promise.resolve([])}
        />,
      );
    });

    const filters = within(
      screen.getByRole("group", { name: "Filtrar ingresos" }),
    );

    expect(await screen.findByText("Monthly salary")).toBeInTheDocument();
    expect(await screen.findByText("Total USD")).toBeInTheDocument();
    expect(
      await filters.findByRole("button", { name: /categor/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "" })).not.toBeInTheDocument();
  });
});

describe("Incomes with no incomes yet", () => {
  it("shows the same totals and filters as with data, not an emptier page", () => {
    renderEmptyIncomes();

    expect(
      screen.getByRole("list", { name: "Total de ingresos por moneda" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Desde")).toBeInTheDocument();
    expect(screen.getByText("Hasta")).toBeInTheDocument();
    expect(screen.getByText("Categoría")).toBeInTheDocument();
    expect(screen.getByText("Moneda")).toBeInTheDocument();
    // The table's own empty state is still what fills the rest.
    expect(screen.getByText("Todavía no hay ingresos")).toBeInTheDocument();
  });
});

describe("Incomes empty state with the current-month range on", () => {
  it("still invites a brand-new user to add an income, since the range hides nothing", () => {
    // No currencies means the user has no incomes in any month.
    renderEmptyIncomes({ query: CURRENT_MONTH, currencies: [] });

    expect(screen.getByText("Todavía no hay ingresos")).toBeInTheDocument();
    expect(
      screen.queryByText("Ningún ingreso coincide con estos filtros"),
    ).not.toBeInTheDocument();
  });

  it("says nothing matches when incomes exist outside the range", () => {
    renderEmptyIncomes({ query: CURRENT_MONTH, currencies: ["ARS"] });

    expect(
      screen.getByText("Ningún ingreso coincide con estos filtros"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Todavía no hay ingresos"),
    ).not.toBeInTheDocument();
  });

  it("offers no Clear filters while the view is already at its defaults, since it would do nothing", () => {
    renderEmptyIncomes({ query: CURRENT_MONTH, currencies: ["ARS"] });

    expect(
      screen.queryByRole("button", { name: "Limpiar filtros" }),
    ).not.toBeInTheDocument();
  });

  it("treats a range that ends today as a filter, since the default reaches the end of the month", () => {
    renderEmptyIncomes({
      query: { ...CURRENT_MONTH, to: TODAY },
      currencies: ["ARS"],
    });

    expect(
      screen.getAllByRole("button", { name: "Limpiar filtros" }),
    ).toHaveLength(2);
  });

  it("offers Clear filters, in the bar and in the empty state, once something is not the default", () => {
    renderEmptyIncomes({
      query: { ...CURRENT_MONTH, currency: "USD" },
      currencies: ["ARS"],
    });

    expect(
      screen.getAllByRole("button", { name: "Limpiar filtros" }),
    ).toHaveLength(2);
  });
});

describe("Incomes Clear filters", () => {
  beforeEach(() => {
    router.push.mockReset();
  });

  const messy = {
    ...DEFAULT_ENTRIES_QUERY,
    from: "2026-01-01",
    to: "2026-02-01",
    categoryId: "c1",
    currency: "USD",
  };

  it("goes back to the default state: a clean URL, which the server resolves to the current month", () => {
    renderEmptyIncomes({ query: messy, currencies: ["ARS"] });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpiar filtros" })[0],
    );

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("keeps the sort while it resets the filters", () => {
    renderEmptyIncomes({
      query: { ...messy, sort: "description", direction: "asc" },
      currencies: ["ARS"],
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpiar filtros" })[0],
    );

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/incomes?sort=description",
    );
  });

  it("brings the range back even when the user had removed the dates", () => {
    renderEmptyIncomes({
      query: { ...DEFAULT_ENTRIES_QUERY, from: null, to: null },
      currencies: ["ARS"],
    });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpiar filtros" })[0],
    );

    expect(router.push).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("also resets from the empty state's own button", () => {
    renderEmptyIncomes({ query: messy, currencies: ["ARS"] });

    const buttons = screen.getAllByRole("button", { name: "Limpiar filtros" });

    fireEvent.click(buttons[buttons.length - 1]);

    expect(router.push).toHaveBeenCalledWith("/dashboard/incomes");
  });
});

describe("Incomes header actions", () => {
  it("renders a single Actions trigger instead of the three buttons", () => {
    const { container } = renderIncomes();
    const buttons = within(header(container)).getAllByRole("button");

    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveTextContent("Acciones");
    expect(
      within(header(container)).queryByRole("button", { name: "Recurrentes" }),
    ).toBeNull();
    expect(
      within(header(container)).queryByRole("button", {
        name: "Administrar categorías",
      }),
    ).toBeNull();
    expect(
      within(header(container)).queryByRole("button", {
        name: "Agregar ingreso",
      }),
    ).toBeNull();
  });

  it("announces a menu popup on the trigger", () => {
    renderIncomes();

    expect(trigger()).toHaveAttribute("aria-haspopup", "true");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });

  it("lists Add income, Recurring, the repayments and Manage categories in that order", async () => {
    renderIncomes();

    const actions = trigger();
    const menu = await openMenu();

    // The rest of the page is hidden from assistive tech while the menu is open.
    expect(actions).toHaveAttribute("aria-expanded", "true");
    expect(
      within(menu)
        .getAllByRole("menuitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Agregar ingreso",
      "Recurrentes",
      "Devolución en cuotas",
      "Devoluciones en cuotas",
      "Administrar categorías",
      "Ayuda de íconos",
    ]);
  });

  it("takes the user to the help page from Ayuda de íconos", async () => {
    router.push.mockReset();
    renderIncomes();

    await choose("Ayuda de íconos");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/help");
  });

  it("opens the repayment planner from Devolución en cuotas", async () => {
    renderIncomes();

    await choose("Devolución en cuotas");

    expect(
      await screen.findByRole("heading", { name: "Devolución en cuotas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Paso 1 de 2 · Datos de la devolución"),
    ).toBeVisible();
  });

  it("opens the month's repayments from Devoluciones en cuotas", async () => {
    renderIncomes();

    await choose("Devoluciones en cuotas");

    expect(
      await screen.findByRole("heading", {
        name: "Devoluciones en cuotas de Septiembre de 2026",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Elegí cuántas cuotas cobrás este mes."),
    ).toBeVisible();
    expect(screen.getByText("Préstamo a Juan")).toBeVisible();
  });

  it("opens each repayments drawer from scratch every time", async () => {
    renderIncomes();

    await choose("Devoluciones en cuotas");

    const stepper = await screen.findByRole("textbox", {
      name: "Cuotas este mes de Préstamo a Juan",
    });

    fireEvent.change(stepper, { target: { value: "3" } });
    fireEvent.blur(stepper);
    expect(stepper).toHaveValue("3");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", {
          name: "Devoluciones en cuotas de Septiembre de 2026",
        }),
      ).not.toBeInTheDocument(),
    );

    await choose("Devoluciones en cuotas");

    expect(
      await screen.findByRole("textbox", {
        name: "Cuotas este mes de Préstamo a Juan",
      }),
    ).toHaveValue("1");
  });

  it("opens the income form from Add income", async () => {
    renderIncomes();

    await choose("Agregar ingreso");

    expect(
      await screen.findByRole("heading", { name: "Agregar ingreso" }),
    ).toBeInTheDocument();
  });

  it("opens the recurring list from Recurring", async () => {
    renderIncomes();

    await choose("Recurrentes");

    expect(
      await screen.findByRole("heading", { name: "Ingresos recurrentes" }),
    ).toBeInTheDocument();
  });

  it("opens the categories drawer from Manage categories", async () => {
    renderIncomes();

    await choose("Administrar categorías");

    expect(
      await screen.findByRole("heading", { name: "Administrar categorías" }),
    ).toBeInTheDocument();
  });
});

describe("Incomes status toggle", () => {
  const box = () =>
    screen.getByRole("checkbox", {
      name: "Marcar Monthly salary como cobrado",
    });

  beforeEach(() => {
    actions.setIncomeStatusAction.mockReset();
  });

  it("asks the server to flip the income to planned when a collected one is unchecked", async () => {
    actions.setIncomeStatusAction.mockResolvedValue({ status: "success" });
    renderIncomes();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(actions.setIncomeStatusAction).toHaveBeenCalledWith(
      "inc_1",
      "PLANNED",
    );
  });

  it("flips the checkbox at once, before the server answers", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.setIncomeStatusAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderIncomes();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(box()).not.toBeChecked();

    await act(async () => {
      finish({ status: "success" });
    });
  });

  it("puts the checkbox back when the server refuses", async () => {
    actions.setIncomeStatusAction.mockResolvedValue({
      status: "error",
      message: "No se pudo.",
    });
    renderIncomes();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(box()).toBeChecked();
  });
});
