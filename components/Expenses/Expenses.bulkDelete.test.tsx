// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const actions = vi.hoisted(() => ({
  setExpenseStatusAction: vi.fn(),
  deleteExpenseAction: vi.fn(),
  deleteExpensesAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/core/expenses/actions", () => ({
  ...actions,
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
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
const planActions = vi.hoisted(() => ({
  createInstallmentPlanAction: vi.fn(),
  deleteInstallmentPlanAction: vi.fn(),
}));

vi.mock("@/core/installments/actions", () => planActions);

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { Expenses } from "./Expenses";
import type { ExpenseRow, ExpensesTableData } from "./types";

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
  status: "PLANNED",
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

const GYM: ExpenseRow = { ...ROW, id: "exp_2", description: "Gym" };
const TAXI: ExpenseRow = { ...ROW, id: "exp_3", description: "Taxi" };

const TODAY = "2026-09-15";
const CURRENT_MONTH = {
  ...DEFAULT_ENTRIES_QUERY,
  from: "2026-09-01",
  to: "2026-09-30",
};
const TABLE: ExpensesTableData = {
  rows: [ROW, GYM, TAXI],
  pagination: { page: 1, totalPages: 2, total: 30, pageSize: 25 },
  hasAnyExpenses: true,
};

const renderExpenses = (table: ExpensesTableData = TABLE) =>
  render(
    <Expenses
      today={TODAY}
      query={CURRENT_MONTH}
      totals={[]}
      categories={[{ id: "c1", name: "Alquiler", count: 3 }]}
      currencies={["ARS"]}
      table={table}
      recurring={{
        month: "2026-09",
        monthLabel: "Septiembre de 2026",
        pending: [],
        decided: [],
        pendingCount: 0,
        plans: [],
      }}
      cards={[]}
    />,
  );

const tick = (description: string) =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: `Seleccionar ${description}` }),
  );
// The dialog is modal, so while it is open the page behind it is hidden from the accessibility tree.
const HIDDEN = { hidden: true } as const;
const bar = () =>
  screen.queryByRole("region", {
    name: "Acciones para la selección",
    ...HIDDEN,
  });
const rowOf = (description: string) =>
  screen
    .getByRole("rowheader", { name: new RegExp(description), ...HIDDEN })
    .closest("tr") as HTMLElement;

// Lets the transition that ran the delete finish, which is what gives the rows back after a failure.
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Expenses selection", () => {
  it("shows no bar until a row is selected", () => {
    renderExpenses();

    expect(bar()).not.toBeInTheDocument();
  });

  it("shows the bar between the filters and the table, counting the selected rows", () => {
    renderExpenses();

    tick("Monthly rent");

    expect(bar()).toHaveTextContent("1 seleccionada");
    expect(
      screen
        .getByRole("group", { name: "Filtrar gastos" })
        .compareDocumentPosition(bar()!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      bar()!.compareDocumentPosition(screen.getByRole("grid")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    tick("Gym");

    expect(bar()).toHaveTextContent("2 seleccionadas");
  });

  it("selects the whole page from the header checkbox", () => {
    renderExpenses();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(bar()).toHaveTextContent("3 seleccionadas");
    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    ).toBeChecked();
  });

  it("shows the header checkbox as indeterminate while only some rows are selected", () => {
    renderExpenses();

    tick("Gym");

    expect(
      (
        screen.getByRole("checkbox", {
          name: "Seleccionar todas las filas de esta página",
        }) as HTMLInputElement
      ).indeterminate,
    ).toBe(true);
  });

  it("drops the selection with Quitar selección", () => {
    renderExpenses();

    tick("Gym");
    fireEvent.click(screen.getByRole("button", { name: "Quitar selección" }));

    expect(bar()).not.toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Gym" }),
    ).not.toBeChecked();
  });

  it("unticking the last row hides the bar", () => {
    renderExpenses();

    tick("Gym");
    tick("Gym");

    expect(bar()).not.toBeInTheDocument();
  });

  it("clears the selection when the sort, a filter or the page changes", () => {
    renderExpenses();

    tick("Gym");
    fireEvent.click(screen.getByRole("columnheader", { name: /Descripción/ }));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(bar()).not.toBeInTheDocument();

    tick("Taxi");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(router.push).toHaveBeenCalledTimes(2);
    expect(bar()).not.toBeInTheDocument();
  });

  it("forgets a selected row once the refreshed rows no longer have it", () => {
    const { rerender } = renderExpenses();

    tick("Gym");
    tick("Taxi");
    expect(bar()).toHaveTextContent("2 seleccionadas");

    rerender(
      <Expenses
        today={TODAY}
        query={CURRENT_MONTH}
        totals={[]}
        categories={[{ id: "c1", name: "Alquiler", count: 2 }]}
        currencies={["ARS"]}
        table={{ ...TABLE, rows: [ROW, TAXI] }}
        recurring={{
          month: "2026-09",
          monthLabel: "Septiembre de 2026",
          pending: [],
          decided: [],
          pendingCount: 0,
          plans: [],
        }}
        cards={[]}
      />,
    );

    expect(bar()).toHaveTextContent("1 seleccionada");
  });

  it("keeps the status checkbox and the row buttons independent of the selection", () => {
    actions.setExpenseStatusAction.mockResolvedValue({ status: "success" });
    renderExpenses();

    tick("Gym");

    expect(bar()).toHaveTextContent("1 seleccionada");
    expect(
      screen.getByRole("checkbox", { name: "Marcar Gym como pagado" }),
    ).not.toBeChecked();
  });
});

describe("Expenses bulk delete", () => {
  const openDialog = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    return screen.findByRole("alertdialog");
  };

  it("asks, with the right number and plural, before deleting the selection", async () => {
    renderExpenses();

    tick("Monthly rent");
    tick("Gym");

    const dialog = await openDialog();

    expect(within(dialog).getByText("¿Eliminar 2 gastos?")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Esta acción no se puede deshacer."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    ).toBeEnabled();
    expect(actions.deleteExpensesAction).not.toHaveBeenCalled();
  });

  it("uses the singular for one expense", async () => {
    renderExpenses();

    tick("Gym");

    expect(
      within(await openDialog()).getByText("¿Eliminar 1 gasto?"),
    ).toBeInTheDocument();
  });

  it("deletes nothing when cancelled", async () => {
    renderExpenses();

    tick("Gym");

    const dialog = await openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));

    expect(actions.deleteExpensesAction).not.toHaveBeenCalled();
    expect(bar()).toHaveTextContent("1 seleccionada");
  });

  it("deletes the selected ids through one action call and clears the selection", async () => {
    actions.deleteExpensesAction.mockResolvedValue({
      status: "success",
      deleted: 2,
    });
    renderExpenses();

    tick("Monthly rent");
    tick("Taxi");

    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    expect(actions.deleteExpensesAction).toHaveBeenCalledTimes(1);
    expect(actions.deleteExpensesAction).toHaveBeenCalledWith([
      "exp_1",
      "exp_3",
    ]);
    expect(bar()).not.toBeInTheDocument();
  });

  it("shows the rows as being deleted, and locks them, until the delete answers", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    actions.deleteExpensesAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderExpenses();

    tick("Monthly rent");
    tick("Gym");

    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    // Pending: the dialog says so, and the table already shows which rows are going.
    expect(
      within(dialog).getByRole("button", { name: /Eliminando/ }),
    ).toBeInTheDocument();
    expect(rowOf("Monthly rent")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Gym")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Taxi")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Monthly rent", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Gym", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Gym como pagado",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Seleccionar Monthly rent",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Editar Taxi", ...HIDDEN }),
    ).toBeEnabled();

    await act(async () => {
      finish({ status: "success", deleted: 2 });
    });
  });

  it("gives the rows back, and shows the error, when the delete fails", async () => {
    actions.deleteExpensesAction.mockResolvedValue({
      status: "error",
      message: "No se encontraron los gastos seleccionados.",
    });
    renderExpenses();

    tick("Monthly rent");
    tick("Gym");

    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    expect(
      within(dialog).getByText("No se encontraron los gastos seleccionados."),
    ).toBeInTheDocument();
    await settle();

    expect(rowOf("Monthly rent")).not.toHaveAttribute("data-busy");
    expect(rowOf("Gym")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Monthly rent", ...HIDDEN }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Gym", ...HIDDEN }),
    ).toBeEnabled();
    // The selection is kept, so the user can try again.
    expect(bar()).toHaveTextContent("2 seleccionadas");
  });

  it("locks the bar while the rows are being deleted", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    actions.deleteExpensesAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderExpenses();

    tick("Gym");

    const dialog = await openDialog();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    expect(
      screen.getByRole("button", { name: "Eliminar selección", ...HIDDEN }),
    ).toBeDisabled();

    // A transition that never ends would hold every later one of the file back.
    await act(async () => {
      finish({ status: "success", deleted: 1 });
    });
  });
});

describe("Expenses single delete", () => {
  const confirmSingle = async (description: string) => {
    fireEvent.click(
      screen.getByRole("button", { name: `Eliminar ${description}` }),
    );

    const dialog = await screen.findByRole("alertdialog");

    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });

    return dialog;
  };

  it("shows the row as being deleted, and not actionable, until the delete answers", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteExpenseAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderExpenses();

    await confirmSingle("Gym");

    expect(rowOf("Gym")).toHaveAttribute("data-busy", "true");
    expect(
      screen.getByRole("button", { name: "Editar Gym", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Gym", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Gym como pagado",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", { name: "Seleccionar Gym", ...HIDDEN }),
    ).toBeDisabled();
    expect(rowOf("Monthly rent")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Monthly rent", ...HIDDEN }),
    ).toBeEnabled();

    await act(async () => {
      finish({ status: "success" });
    });
  });

  it("gives the row back, and shows the error, when the delete fails", async () => {
    actions.deleteExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto.",
    });
    renderExpenses();

    const dialog = await confirmSingle("Gym");

    expect(
      within(dialog).getByText("No se encontró el gasto."),
    ).toBeInTheDocument();
    await settle();

    expect(rowOf("Gym")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Gym", ...HIDDEN }),
    ).toBeEnabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Gym como pagado",
        ...HIDDEN,
      }),
    ).toBeEnabled();
  });
});

describe("Expenses plan delete", () => {
  const CUOTA_1: ExpenseRow = {
    ...ROW,
    id: "cuota_1",
    description: "Heladera (1/3)",
    installmentPlanId: "plan_1",
    installmentNumber: 1,
    planProgress: { total: 3, settled: 1 },
  };
  const CUOTA_2: ExpenseRow = {
    ...CUOTA_1,
    id: "cuota_2",
    description: "Heladera (2/3)",
    installmentNumber: 2,
  };
  const OTHER: ExpenseRow = { ...ROW, id: "exp_9", description: "Taxi" };
  const PLAN_TABLE: ExpensesTableData = {
    ...TABLE,
    rows: [CUOTA_1, CUOTA_2, OTHER],
  };

  const confirmPlan = async () => {
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Heladera (1/3)" }),
    );

    const dialog = await screen.findByRole("alertdialog");

    fireEvent.click(
      within(dialog).getByRole("radio", { name: /Eliminar el plan completo/ }),
    );
    fireEvent.click(
      within(dialog).getByRole("checkbox", {
        name: /Entiendo que se eliminan todas las cuotas del plan/,
      }),
    );
    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Eliminar plan completo" }),
      );
    });

    return dialog;
  };

  it("shows every row of the plan on the page as being deleted, and only those, until the delete answers", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    planActions.deleteInstallmentPlanAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderExpenses(PLAN_TABLE);

    await confirmPlan();

    expect(planActions.deleteInstallmentPlanAction).toHaveBeenCalledWith(
      "plan_1",
    );
    expect(rowOf("1/3")).toHaveAttribute("data-busy", "true");
    expect(rowOf("2/3")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Taxi")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Heladera (2/3)", ...HIDDEN }),
    ).toBeDisabled();

    await act(async () => {
      finish({ status: "success", deleted: 3 });
    });
  });

  it("gives the rows back, and shows the error, when deleting the plan fails", async () => {
    planActions.deleteInstallmentPlanAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el plan de cuotas.",
    });
    renderExpenses(PLAN_TABLE);

    const dialog = await confirmPlan();

    expect(
      within(dialog).getByText("No se encontró el plan de cuotas."),
    ).toBeInTheDocument();
    await settle();

    expect(rowOf("1/3")).not.toHaveAttribute("data-busy");
    expect(rowOf("2/3")).not.toHaveAttribute("data-busy");
  });
});
