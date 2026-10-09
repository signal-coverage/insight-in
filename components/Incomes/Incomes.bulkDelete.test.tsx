// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn() }));
const actions = vi.hoisted(() => ({
  setIncomeStatusAction: vi.fn(),
  deleteIncomeAction: vi.fn(),
  deleteIncomesAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
const planActions = vi.hoisted(() => ({
  createInstallmentPlanAction: vi.fn(),
  applyIncomeInstallmentCountsAction: vi.fn(),
  deleteInstallmentPlanAction: vi.fn(),
}));

vi.mock("@/core/installments/actions", () => planActions);
vi.mock("@/core/incomes/actions", () => ({
  ...actions,
  createIncomeAction: vi.fn(),
  updateIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
  renameCategoryAction: vi.fn(),
  deleteCategoryAction: vi.fn(),
  createRecurringIncomeAction: vi.fn(),
  updateRecurringIncomeAction: vi.fn(),
  deleteRecurringIncomeAction: vi.fn(),
}));

import { DEFAULT_ENTRIES_QUERY } from "@/core/entries/query";

import { Incomes } from "./Incomes";
import type { IncomeRow, IncomesTableData } from "./types";

const ROW: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  status: "PLANNED",
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

const GIG: IncomeRow = { ...ROW, id: "inc_2", description: "Side gig" };
const BONUS: IncomeRow = { ...ROW, id: "inc_3", description: "Bonus" };

// Accounts as the forms receive them: one per currency, so each is preselected.
const ACCOUNTS = [
  {
    id: "acc_1",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "acc_usd",
    currency: "USD",
    label: "Banco Galicia · Cuenta en dólares",
    archived: false,
  },
];

const TABLE: IncomesTableData = {
  rows: [ROW, GIG, BONUS],
  pagination: { page: 1, totalPages: 2, total: 30, pageSize: 25 },
  hasAnyIncomes: true,
};

const renderIncomes = (table: IncomesTableData = TABLE) =>
  render(
    <Incomes
      today="2026-09-15"
      query={DEFAULT_ENTRIES_QUERY}
      totals={[]}
      categories={[{ id: "c1", name: "Salary", count: 3 }]}
      currencies={["USD"]}
      table={table}
      recurring={[]}
      repayments={{
        month: "2026-09",
        monthLabel: "Septiembre de 2026",
        plans: [],
      }}
      reimbursables={[]}
      accounts={ACCOUNTS}
    />,
  );

// The dialog is modal, so while it is open the page behind it is hidden from the accessibility tree.
const HIDDEN = { hidden: true } as const;
const tick = (description: string) =>
  fireEvent.click(
    screen.getByRole("checkbox", { name: `Seleccionar ${description}` }),
  );
const bar = () =>
  screen.queryByRole("region", {
    name: "Acciones para la selección",
    ...HIDDEN,
  });
const rowOf = (description: string) =>
  screen
    .getByRole("rowheader", { name: new RegExp(description), ...HIDDEN })
    .closest("tr") as HTMLElement;
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

beforeEach(() => {
  vi.resetAllMocks();
});

describe("Incomes selection", () => {
  it("shows no bar until a row is selected, then counts them", () => {
    renderIncomes();

    expect(bar()).not.toBeInTheDocument();

    tick("Monthly salary");
    expect(bar()).toHaveTextContent("1 seleccionada");

    tick("Side gig");
    expect(bar()).toHaveTextContent("2 seleccionadas");
  });

  it("selects the whole page from the header and drops the selection with Quitar selección", () => {
    renderIncomes();

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Seleccionar todas las filas de esta página",
      }),
    );

    expect(bar()).toHaveTextContent("3 seleccionadas");

    fireEvent.click(screen.getByRole("button", { name: "Quitar selección" }));

    expect(bar()).not.toBeInTheDocument();
  });

  it("clears the selection when the sort or the page changes", () => {
    renderIncomes();

    tick("Bonus");
    fireEvent.click(screen.getByRole("columnheader", { name: /Descripción/ }));

    expect(router.push).toHaveBeenCalledTimes(1);
    expect(bar()).not.toBeInTheDocument();

    tick("Bonus");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(bar()).not.toBeInTheDocument();
  });

  it("forgets a selected row once the refreshed rows no longer have it", () => {
    const { rerender } = renderIncomes();

    tick("Side gig");
    tick("Bonus");
    expect(bar()).toHaveTextContent("2 seleccionadas");

    rerender(
      <Incomes
        today="2026-09-15"
        query={DEFAULT_ENTRIES_QUERY}
        totals={[]}
        categories={[{ id: "c1", name: "Salary", count: 2 }]}
        currencies={["USD"]}
        table={{ ...TABLE, rows: [ROW, BONUS] }}
        recurring={[]}
        repayments={{
          month: "2026-09",
          monthLabel: "Septiembre de 2026",
          plans: [],
        }}
        reimbursables={[]}
        accounts={ACCOUNTS}
      />,
    );

    expect(bar()).toHaveTextContent("1 seleccionada");
  });
});

describe("Incomes bulk delete", () => {
  const openDialog = async () => {
    fireEvent.click(screen.getByRole("button", { name: "Eliminar selección" }));

    return screen.findByRole("alertdialog");
  };
  const confirm = async (dialog: HTMLElement) => {
    await act(async () => {
      fireEvent.click(within(dialog).getByRole("button", { name: "Eliminar" }));
    });
  };

  it("asks with the right plural, and deletes nothing until confirmed", async () => {
    renderIncomes();

    tick("Monthly salary");

    expect(
      within(await openDialog()).getByText("¿Eliminar 1 ingreso?"),
    ).toBeInTheDocument();
    expect(actions.deleteIncomesAction).not.toHaveBeenCalled();
  });

  it("deletes the selected ids with one call and clears the selection", async () => {
    actions.deleteIncomesAction.mockResolvedValue({
      status: "success",
      deleted: 2,
    });
    renderIncomes();

    tick("Monthly salary");
    tick("Bonus");

    const dialog = await openDialog();

    expect(
      within(dialog).getByText("¿Eliminar 2 ingresos?"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText("Esta acción no se puede deshacer."),
    ).toBeInTheDocument();

    await confirm(dialog);

    expect(actions.deleteIncomesAction).toHaveBeenCalledTimes(1);
    expect(actions.deleteIncomesAction).toHaveBeenCalledWith([
      "inc_1",
      "inc_3",
    ]);
    expect(bar()).not.toBeInTheDocument();
  });

  it("shows the rows as being deleted, and locks them, until the delete answers", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    actions.deleteIncomesAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderIncomes();

    tick("Monthly salary");
    tick("Side gig");
    await confirm(await openDialog());

    expect(rowOf("Monthly salary")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Side gig")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Bonus")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Monthly salary", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Side gig", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Side gig como cobrado",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Editar Bonus", ...HIDDEN }),
    ).toBeEnabled();

    // A transition that never ends would hold every later one of the file back.
    await act(async () => {
      finish({ status: "success", deleted: 2 });
    });
  });

  it("gives the rows back, and shows the error, when the delete fails", async () => {
    actions.deleteIncomesAction.mockResolvedValue({
      status: "error",
      message: "No se encontraron los ingresos seleccionados.",
    });
    renderIncomes();

    tick("Monthly salary");

    const dialog = await openDialog();

    await confirm(dialog);
    await settle();

    expect(
      within(dialog).getByText("No se encontraron los ingresos seleccionados."),
    ).toBeInTheDocument();
    expect(rowOf("Monthly salary")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Monthly salary", ...HIDDEN }),
    ).toBeEnabled();
    expect(bar()).toHaveTextContent("1 seleccionada");
  });
});

describe("Incomes single delete", () => {
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

    actions.deleteIncomeAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderIncomes();

    await confirmSingle("Side gig");

    expect(rowOf("Side gig")).toHaveAttribute("data-busy", "true");
    expect(
      screen.getByRole("button", { name: "Editar Side gig", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Eliminar Side gig", ...HIDDEN }),
    ).toBeDisabled();
    expect(
      screen.getByRole("checkbox", {
        name: "Marcar Side gig como cobrado",
        ...HIDDEN,
      }),
    ).toBeDisabled();
    expect(rowOf("Bonus")).not.toHaveAttribute("data-busy");

    await act(async () => {
      finish({ status: "success" });
    });
  });

  it("gives the row back, and shows the error, when the delete fails", async () => {
    actions.deleteIncomeAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el ingreso.",
    });
    renderIncomes();

    const dialog = await confirmSingle("Side gig");

    await settle();

    expect(
      within(dialog).getByText("No se encontró el ingreso."),
    ).toBeInTheDocument();
    expect(rowOf("Side gig")).not.toHaveAttribute("data-busy");
    expect(
      screen.getByRole("button", { name: "Editar Side gig", ...HIDDEN }),
    ).toBeEnabled();
  });
});

describe("Incomes plan delete", () => {
  const CUOTA_1: IncomeRow = {
    ...ROW,
    id: "cuota_1",
    description: "Préstamo (1/3)",
    installmentPlanId: "plan_1",
    installmentNumber: 1,
    planProgress: { total: 3, settled: 1 },
  };
  const CUOTA_2: IncomeRow = {
    ...CUOTA_1,
    id: "cuota_2",
    description: "Préstamo (2/3)",
    installmentNumber: 2,
  };
  const PLAN_TABLE: IncomesTableData = {
    ...TABLE,
    rows: [CUOTA_1, CUOTA_2, BONUS],
  };

  it("shows every row of the plan on the page as being deleted, and only those, until the delete answers", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    planActions.deleteInstallmentPlanAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderIncomes(PLAN_TABLE);

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar Préstamo (1/3)" }),
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

    expect(planActions.deleteInstallmentPlanAction).toHaveBeenCalledWith(
      "plan_1",
    );
    expect(rowOf("1/3")).toHaveAttribute("data-busy", "true");
    expect(rowOf("2/3")).toHaveAttribute("data-busy", "true");
    expect(rowOf("Bonus")).not.toHaveAttribute("data-busy");

    await act(async () => {
      finish({ status: "success", deleted: 3 });
    });
  });
});
