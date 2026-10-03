// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteExpenseAction: vi.fn() }));
const planActions = vi.hoisted(() => ({
  deleteInstallmentPlanAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);
vi.mock("@/core/installments/actions", () => planActions);

import type { ExpenseRow } from "../../types";
import { DeleteExpenseDialog } from "./DeleteExpenseDialog";

const EXPENSE: ExpenseRow = {
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

const renderDialog = (row: ExpenseRow = EXPENSE) => {
  const onClose = vi.fn();
  const onDeleting = vi.fn();
  const onDeletingPlan = vi.fn();

  render(
    <DeleteExpenseDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      onDeleting={onDeleting}
      onDeletingPlan={onDeletingPlan}
      expense={row}
    />,
  );

  return { onClose, onDeleting, onDeletingPlan };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteExpenseDialog", () => {
  it("names the expense and asks for confirmation", () => {
    renderDialog();

    expect(screen.getByText("¿Eliminar este gasto?")).toBeInTheDocument();
    expect(screen.getByText(/Monthly rent/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("deletes through the action and closes", async () => {
    actions.deleteExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteExpenseAction).toHaveBeenCalledWith("exp_1");
  });

  it("marks the row as being deleted before it asks the server, and not at all if nothing is confirmed", async () => {
    actions.deleteExpenseAction.mockResolvedValue({ status: "success" });
    const { onDeleting } = renderDialog();

    expect(onDeleting).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteExpenseAction).toHaveBeenCalledWith("exp_1"),
    );
    expect(onDeleting).toHaveBeenCalledWith(["exp_1"]);
    expect(onDeleting.mock.invocationCallOrder[0]).toBeLessThan(
      actions.deleteExpenseAction.mock.invocationCallOrder[0],
    );
  });

  it("shows 'Eliminando…' with a spinner, and locks Cancel, while it deletes", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteExpenseAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    const pending = await screen.findByRole("button", { name: /Eliminando/ });

    expect(pending).toHaveTextContent("Eliminando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the dialog open and shows the error when the delete fails", async () => {
    actions.deleteExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto.",
    });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(
      await screen.findByText("No se encontró el gasto."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

const INSTALLMENT: ExpenseRow = {
  ...EXPENSE,
  installmentPlanId: "plan_1",
  installmentNumber: 4,
  planProgress: { total: 12, settled: 3 },
};

const choosePlan = () =>
  fireEvent.click(
    screen.getByRole("radio", { name: /Eliminar el plan completo/ }),
  );

const acknowledge = () =>
  fireEvent.click(
    screen.getByRole("checkbox", {
      name: /Entiendo que se eliminan todas las cuotas del plan/,
    }),
  );

describe("DeleteExpenseDialog dialog of an installment", () => {
  it("offers no choice for an entry that belongs to no plan", () => {
    renderDialog();

    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("offers no choice when the progress of its plan is not known", () => {
    renderDialog({ ...INSTALLMENT, planProgress: undefined });

    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("offers 'solo esta cuota' (selected by default) and 'el plan completo'", () => {
    renderDialog(INSTALLMENT);

    expect(
      screen.getByRole("radio", { name: /Eliminar solo esta cuota/ }),
    ).toBeChecked();
    expect(
      screen.getByRole("radio", { name: /Eliminar el plan completo/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
  });

  it("deletes only that cuota by default, with the usual action", async () => {
    actions.deleteExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose, onDeleting, onDeletingPlan } = renderDialog(INSTALLMENT);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteExpenseAction).toHaveBeenCalledWith("exp_1");
    expect(onDeleting).toHaveBeenCalledWith(["exp_1"]);
    expect(onDeletingPlan).not.toHaveBeenCalled();
    expect(planActions.deleteInstallmentPlanAction).not.toHaveBeenCalled();
  });

  it("states how many cuotas the plan has and how many are pagadas once the plan is chosen", () => {
    renderDialog(INSTALLMENT);

    choosePlan();

    expect(
      screen.getByText(
        /Este plan tiene 12 cuotas en total y 3 ya marcadas como pagadas\./,
      ),
    ).toBeInTheDocument();
  });

  it("cannot delete the plan until the user acknowledges it", () => {
    const { onClose } = renderDialog(INSTALLMENT);

    choosePlan();

    const confirm = screen.getByRole("button", {
      name: "Eliminar plan completo",
    });

    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(planActions.deleteInstallmentPlanAction).not.toHaveBeenCalled();

    acknowledge();

    expect(
      screen.getByRole("button", { name: "Eliminar plan completo" }),
    ).toBeEnabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("forgets the acknowledgement when the user goes back to a single cuota and picks the plan again", () => {
    renderDialog(INSTALLMENT);

    choosePlan();
    acknowledge();
    fireEvent.click(
      screen.getByRole("radio", { name: /Eliminar solo esta cuota/ }),
    );
    choosePlan();

    expect(
      screen.getByRole("button", { name: "Eliminar plan completo" }),
    ).toBeDisabled();
  });

  it("deletes the whole plan through its own action, marking the plan's rows as going away first", async () => {
    planActions.deleteInstallmentPlanAction.mockResolvedValue({
      status: "success",
      deleted: 12,
    });
    const { onClose, onDeleting, onDeletingPlan } = renderDialog(INSTALLMENT);

    choosePlan();
    acknowledge();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar plan completo" }),
    );

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(planActions.deleteInstallmentPlanAction).toHaveBeenCalledWith(
      "plan_1",
    );
    expect(actions.deleteExpenseAction).not.toHaveBeenCalled();
    expect(onDeletingPlan).toHaveBeenCalledWith("plan_1");
    expect(onDeleting).not.toHaveBeenCalled();
    expect(onDeletingPlan.mock.invocationCallOrder[0]).toBeLessThan(
      planActions.deleteInstallmentPlanAction.mock.invocationCallOrder[0],
    );
  });

  it("shows 'Eliminando…' and locks the choice while the plan is deleted", async () => {
    let finish!: (value: { status: "success"; deleted: number }) => void;

    planActions.deleteInstallmentPlanAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { onClose } = renderDialog(INSTALLMENT);

    choosePlan();
    acknowledge();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar plan completo" }),
    );

    expect(
      await screen.findByRole("button", { name: /Eliminando/ }),
    ).toBeInTheDocument();
    screen
      .getAllByRole("radio")
      .forEach((radio) => expect(radio).toBeDisabled());
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success", deleted: 12 });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the dialog open and shows the error when deleting the plan fails", async () => {
    planActions.deleteInstallmentPlanAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el plan de cuotas.",
    });
    const { onClose } = renderDialog(INSTALLMENT);

    choosePlan();
    acknowledge();
    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar plan completo" }),
    );

    expect(
      await screen.findByText("No se encontró el plan de cuotas."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
