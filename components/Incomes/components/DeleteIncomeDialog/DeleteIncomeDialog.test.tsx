// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteIncomeAction: vi.fn() }));

vi.mock("@/core/incomes/actions", () => actions);

import type { IncomeRow } from "../../types";
import { DeleteIncomeDialog } from "./DeleteIncomeDialog";

const INCOME: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-09-01",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  recurringIncomeId: null,
  status: "SETTLED",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "1 sept 2026",
};

const renderDialog = () => {
  const onClose = vi.fn();

  render(
    <DeleteIncomeDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      income={INCOME}
    />,
  );

  return { onClose };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteIncomeDialog", () => {
  it("asks for confirmation with a plain Delete button and an enabled Cancel", () => {
    renderDialog();

    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("shows 'Deleting…' with a spinner, and locks Cancel, while it deletes", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteIncomeAction.mockReturnValue(
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
    expect(actions.deleteIncomeAction).toHaveBeenCalledWith("inc_1");

    finish({ status: "success" });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
