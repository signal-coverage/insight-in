// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const actions = vi.hoisted(() => ({ setExpenseStatusAction: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/expenses/actions", () => ({
  ...actions,
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
  deleteExpensesAction: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
}));
vi.mock("@/core/expenses/recurringActions", () => ({
  applyRecurringDecisionsAction: vi.fn(),
  setRecurringDecisionAction: vi.fn(),
  removeRecurringExpenseAction: vi.fn(),
  updateRecurringExpenseAction: vi.fn(),
}));
vi.mock("@/core/installments/actions", () => ({
  createInstallmentPlanAction: vi.fn(),
}));

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { Expenses } from "./Expenses";
import type {
  ExpenseRow,
  InstallmentPlanRow,
  RecurringData,
  RecurringRow,
} from "./types";

const ROW: ExpenseRow = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  medium: "DIGITAL",
  status: "SETTLED",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 sept 2026",
};

const PLAN: InstallmentPlanRow = {
  id: "plan_1",
  description: "Heladera",
  categoryName: "Hogar",
  currency: "ARS",
  totalCuotas: 12,
  doneCount: 3,
  pendingCount: 9,
  nextAmount: 10000000,
  defaultCount: 1,
  nextAmountLabel: "$ 100.000,00",
  progressLabel: "3 de 12 · quedan 9",
};

// Mid-month on purpose: the default range is the whole month, not the days up to today.
const TODAY = "2026-09-15";
const PAGINATION = { page: 1, totalPages: 1, total: 1, pageSize: 25 };
const CURRENT_MONTH = {
  ...DEFAULT_ENTRIES_QUERY,
  from: "2026-09-01",
  to: "2026-09-30",
};
const TOTALS = [
  {
    currency: "ARS",
    label: "$ 350.000,50",
    settled: "$ 350.000,50",
    pending: "$ 0,00",
  },
];

const TEMPLATE: RecurringRow = {
  id: "rec_1",
  description: "Gym",
  amount: 4500000,
  currency: "ARS",
  categoryId: "c2",
  categoryName: "Salud",
  notes: null,
  medium: "DIGITAL",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 20,
  decision: null,
  amountLabel: "$ 45.000,00",
  amountDecimal: "45000.00",
  dayLabel: "Día 20",
  originAmountDecimal: null,
  referenceLabel: null,
};

const recurringOf = (
  pending: RecurringRow[],
  plans: InstallmentPlanRow[] = [],
): RecurringData => ({
  month: "2026-09",
  monthLabel: "Septiembre de 2026",
  pending,
  decided: [],
  pendingCount: pending.length,
  plans,
});

const NO_RECURRING = recurringOf([]);

const renderExpenses = (
  query = CURRENT_MONTH,
  recurring: RecurringData = NO_RECURRING,
) =>
  render(
    <Expenses
      today={TODAY}
      query={query}
      totals={TOTALS}
      categories={[{ id: "c1", name: "Alquiler", count: 1 }]}
      currencies={["ARS"]}
      table={{ rows: [ROW], pagination: PAGINATION, hasAnyExpenses: true }}
      recurring={recurring}
      cards={[]}
    />,
  );

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

beforeEach(() => {
  router.push.mockReset();
  actions.setExpenseStatusAction.mockReset();
});

describe("Expenses page", () => {
  it("shows the title, the totals, the filters and the table", () => {
    renderExpenses();

    expect(screen.getByRole("heading", { name: "Gastos" })).toBeInTheDocument();
    expect(
      screen.getByRole("list", { name: "Total de gastos por moneda" }),
    ).toHaveTextContent("Pagado");
    expect(
      screen.getByRole("group", { name: "Filtrar gastos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Monthly rent")).toBeInTheDocument();
  });

  it("offers Add expense, Manage categories, Recurring expenses, Installment purchase and the icon help in the Actions menu, and nothing else", async () => {
    renderExpenses();

    await openMenu();

    expect(
      screen.getAllByRole("menuitem").map((item) => item.textContent),
    ).toEqual([
      "Agregar gasto",
      "Administrar categorías",
      "Gastos recurrentes",
      "Compra en cuotas",
      "Ayuda de íconos",
    ]);
  });

  it("takes the user to the help page from Ayuda de íconos", async () => {
    renderExpenses();

    await choose("Ayuda de íconos");

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith("/dashboard/help");
  });

  it("opens the installment planner from the Actions menu, on its first step", async () => {
    renderExpenses();

    await choose("Compra en cuotas");

    expect(
      await screen.findByRole("heading", { name: "Compra en cuotas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Paso 1 de 2 · Datos de la compra"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("opens the wizard with the purchases in installments next to the recurring expenses", async () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE], [PLAN]));

    await choose("Gastos recurrentes");

    expect(
      await screen.findByRole("heading", { name: "Compras en cuotas" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Heladera")).toBeInTheDocument();
  });

  it("opens the recurring-expenses wizard for the current month from the Actions menu", async () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE]));

    await choose("Gastos recurrentes");

    expect(
      await screen.findByRole("heading", {
        name: "Gastos recurrentes de Septiembre de 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aplicar" })).toBeDisabled();
  });

  it("edits a template from the wizard, with the page's categories to choose from", async () => {
    renderExpenses(
      CURRENT_MONTH,
      recurringOf([{ ...TEMPLATE, categoryId: "c1" }]),
    );

    await choose("Gastos recurrentes");
    fireEvent.click(await screen.findByRole("button", { name: "Editar Gym" }));

    expect(
      await screen.findByRole("heading", { name: "Editar gasto recurrente" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Alquiler",
    );
  });

  it("opens the expense form from Add expense", async () => {
    renderExpenses();

    await choose("Agregar gasto");

    expect(
      await screen.findByRole("button", { name: "Agregar gasto" }),
    ).toHaveAttribute("type", "submit");
  });

  it("opens the categories drawer from Manage categories", async () => {
    renderExpenses();

    await choose("Administrar categorías");

    expect(
      await screen.findByRole("list", { name: "Categorías de gastos" }),
    ).toBeInTheDocument();
  });

  it("opens the form to edit a row", async () => {
    renderExpenses();

    fireEvent.click(
      screen.getByRole("button", { name: "Editar Monthly rent" }),
    );

    expect(
      await screen.findByRole("button", { name: "Guardar cambios" }),
    ).toBeInTheDocument();
  });

  it("asks for confirmation before deleting a row", async () => {
    renderExpenses();

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Monthly rent" }),
    );

    expect(
      await screen.findByText("¿Eliminar este gasto?"),
    ).toBeInTheDocument();
  });
});

describe("Expenses recurring notice", () => {
  const notice = () => screen.queryByRole("status");

  it("tells how many recurring expenses of the month are still unresolved", () => {
    renderExpenses(
      CURRENT_MONTH,
      recurringOf([TEMPLATE, { ...TEMPLATE, id: "rec_2" }]),
    );

    expect(notice()).toHaveTextContent(
      "Tenés 2 gastos recurrentes sin resolver este mes.",
    );
  });

  it("uses the singular for one", () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE]));

    expect(notice()).toHaveTextContent(
      "Tenés 1 gasto recurrente sin resolver este mes.",
    );
  });

  it("is not shown when everything is resolved", () => {
    renderExpenses();

    expect(notice()).not.toBeInTheDocument();
  });

  it("never counts the purchases in installments as unresolved", () => {
    renderExpenses(CURRENT_MONTH, recurringOf([], [PLAN]));

    expect(notice()).not.toBeInTheDocument();
  });

  it("counts only the recurring expenses when there are purchases too", () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE], [PLAN]));

    expect(notice()).toHaveTextContent(
      "Tenés 1 gasto recurrente sin resolver este mes.",
    );
  });

  it("is not counted by the rows that are already decided", () => {
    renderExpenses(CURRENT_MONTH, {
      ...recurringOf([]),
      decided: [{ ...TEMPLATE, decision: "ENABLED" }],
    });

    expect(notice()).not.toBeInTheDocument();
  });

  it("opens the same wizard from its Resolver button", async () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE]));

    fireEvent.click(screen.getByRole("button", { name: "Resolver" }));

    expect(
      await screen.findByRole("heading", {
        name: "Gastos recurrentes de Septiembre de 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Gym", { selector: "span" })).toBeInTheDocument();
  });

  it("sits above the table", () => {
    renderExpenses(CURRENT_MONTH, recurringOf([TEMPLATE]));

    expect(
      notice()!.compareDocumentPosition(screen.getByRole("grid")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("Expenses navigation", () => {
  it("writes a sort change to the URL and goes back to page 1", () => {
    renderExpenses();

    fireEvent.click(screen.getByRole("columnheader", { name: /Descripción/ }));

    expect(router.push).toHaveBeenCalledWith(
      "/dashboard/expenses?sort=description",
    );
  });

  it("offers Clear filters from the URL alone when the view is not the default", () => {
    renderExpenses({ ...CURRENT_MONTH, status: "PLANNED" });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpiar filtros" })[0],
    );

    expect(router.push).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("treats a range that ends today as a filter, since the default reaches the end of the month", () => {
    renderExpenses({ ...CURRENT_MONTH, to: TODAY });

    fireEvent.click(
      screen.getAllByRole("button", { name: "Limpiar filtros" })[0],
    );

    expect(router.push).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("shows no Clear filters button in the default state", () => {
    renderExpenses();

    expect(
      screen.queryByRole("button", { name: "Limpiar filtros" }),
    ).not.toBeInTheDocument();
  });
});

describe("Expenses while its data is still on the way", () => {
  const never = <T,>() => new Promise<T>(() => {});

  it("renders the structure at once and only the data sections wait", () => {
    const { container } = render(
      <Expenses
        today={TODAY}
        query={CURRENT_MONTH}
        totals={never()}
        categories={never()}
        currencies={never()}
        table={never()}
        recurring={never()}
        cards={[]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Gastos" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Acciones" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Filtrar gastos" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText("Todavía no hay gastos")).not.toBeInTheDocument();
    expect(screen.queryByText(/sin resolver/)).not.toBeInTheDocument();
  });
});

describe("Expenses status toggle", () => {
  const box = () =>
    screen.getByRole("checkbox", { name: "Marcar Monthly rent como pagado" });

  it("asks the server to flip the expense to planned when a paid one is unchecked", async () => {
    actions.setExpenseStatusAction.mockResolvedValue({ status: "success" });
    renderExpenses();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(actions.setExpenseStatusAction).toHaveBeenCalledWith(
      "exp_1",
      "PLANNED",
    );
  });

  it("flips the checkbox at once, before the server answers", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.setExpenseStatusAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderExpenses();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(box()).not.toBeChecked();

    await act(async () => {
      finish({ status: "success" });
    });
  });

  it("puts the checkbox back when the server refuses", async () => {
    actions.setExpenseStatusAction.mockResolvedValue({
      status: "error",
      message: "No se pudo.",
    });
    renderExpenses();

    await act(async () => {
      fireEvent.click(box());
    });

    expect(box()).toBeChecked();
  });
});

describe("Expenses empty table", () => {
  it("invites a brand-new user to add the first expense", () => {
    render(
      <Expenses
        today={TODAY}
        query={CURRENT_MONTH}
        totals={[]}
        categories={[]}
        currencies={[]}
        table={{
          rows: [],
          pagination: { ...PAGINATION, total: 0 },
          hasAnyExpenses: false,
        }}
        recurring={NO_RECURRING}
        cards={[]}
      />,
    );

    const table = screen
      .getByText("Todavía no hay gastos")
      .closest("div") as HTMLElement;

    expect(
      within(table.parentElement as HTMLElement).getByRole("button", {
        name: "Agregar gasto",
      }),
    ).toBeInTheDocument();
  });

  it("says nothing matches when expenses exist outside the filters", () => {
    render(
      <Expenses
        today={TODAY}
        query={{ ...CURRENT_MONTH, status: "PLANNED" }}
        totals={[]}
        categories={[]}
        currencies={["ARS"]}
        table={{
          rows: [],
          pagination: { ...PAGINATION, total: 0 },
          hasAnyExpenses: true,
        }}
        recurring={NO_RECURRING}
        cards={[]}
      />,
    );

    expect(
      screen.getByText("Ningún gasto coincide con estos filtros"),
    ).toBeInTheDocument();
  });
});
