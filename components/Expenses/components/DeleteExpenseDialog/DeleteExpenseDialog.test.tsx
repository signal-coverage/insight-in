// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteExpenseAction: vi.fn() }));

vi.mock("@/core/expenses/actions", () => actions);

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
  status: "SETTLED",
  isRecurring: false,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 sept 2026",
};

const renderDialog = () => {
  const onClose = vi.fn();

  render(
    <DeleteExpenseDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      expense={EXPENSE}
    />,
  );

  return { onClose };
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
