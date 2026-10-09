// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteTransferAction: vi.fn() }));

vi.mock("@/core/transfers/actions", () => actions);

import type { TransferRow } from "../../types";
import { DeleteTransferDialog } from "./DeleteTransferDialog";

const ROW: TransferRow = {
  id: "tr_1",
  fromAccountId: "galicia",
  toAccountId: "cash",
  fromLabel: "Galicia · Caja de ahorro",
  toLabel: "Efectivo · Efectivo",
  currency: "ARS",
  amount: 150050,
  date: "2026-10-03",
  notes: null,
  amountLabel: "$ 1.500,50",
  amountDecimal: "1500.50",
  dateLabel: "3 oct 2026",
};

const renderDialog = (transfer: TransferRow | null = ROW) => {
  const onClose = vi.fn();
  const onDeleting = vi.fn();

  render(
    <DeleteTransferDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      onDeleting={onDeleting}
      transfer={transfer}
    />,
  );

  return { onClose, onDeleting };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteTransferDialog", () => {
  it("asks about this transfer, names it and says the destination has to still hold the money", () => {
    renderDialog();

    expect(
      screen.getByRole("heading", { name: "¿Eliminar esta transferencia?" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Galicia · Caja de ahorro a Efectivo · Efectivo \(\$ 1\.500,50\)/,
      ),
    ).toBeVisible();
    expect(
      screen.getByText(/tiene que seguir teniendo ese saldo disponible/),
    ).toBeVisible();
  });

  it("marks the row as going away before it waits, deletes it and closes", async () => {
    actions.deleteTransferAction.mockResolvedValue({ status: "success" });

    const { onClose, onDeleting } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteTransferAction).toHaveBeenCalledWith("tr_1"),
    );
    expect(onDeleting).toHaveBeenCalledWith(["tr_1"]);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the failure and stays open", async () => {
    actions.deleteTransferAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la transferencia.",
    });

    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(
      await screen.findByText("No se encontró la transferencia."),
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows the refusal when the destination already spent the money, naming the account and what it holds, and stays open", async () => {
    const message =
      "No se puede deshacer: Efectivo · Efectivo tiene $ 3,00 y tendría que devolver $ 1.500,50.";

    actions.deleteTransferAction.mockResolvedValue({
      status: "error",
      message,
    });

    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("does nothing without a transfer", () => {
    renderDialog(null);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(actions.deleteTransferAction).not.toHaveBeenCalled();
  });
});
