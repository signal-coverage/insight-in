// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmDeleteDialog } from "./ConfirmDeleteDialog";

const onConfirm = vi.fn();

const renderDialog = () => {
  const onDeleted = vi.fn();
  const onOpenChange = vi.fn();

  render(
    <ConfirmDeleteDialog
      isOpen
      onOpenChange={onOpenChange}
      onDeleted={onDeleted}
      heading="¿Eliminar la cuenta Pesos prueba?"
      warning="Se elimina de forma permanente."
      onConfirm={onConfirm}
    />,
  );

  return { onDeleted, onOpenChange };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ConfirmDeleteDialog", () => {
  it("asks the question it was given and shows the warning, with Cancelar and Eliminar, without deleting yet", () => {
    renderDialog();

    expect(
      screen.getByRole("heading", {
        name: "¿Eliminar la cuenta Pesos prueba?",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Se elimina de forma permanente.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Cancelar closes the dialog and deletes nothing", () => {
    const { onDeleted, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("confirming calls the action once and, when it went through, tells the caller", async () => {
    onConfirm.mockResolvedValue({ status: "success" });

    const { onDeleted } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows the refusal, keeps the dialog open and lets the user try again or cancel", async () => {
    const message =
      "Esta cuenta ya tiene movimientos, así que no se puede eliminar. Archivala en su lugar.";

    onConfirm.mockResolvedValue({ status: "error", message });

    const { onDeleted, onOpenChange } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText(message)).toBeVisible();
    expect(onDeleted).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled(),
    );
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("shows the pending label with a spinner and blocks Cancelar while the delete is in flight", async () => {
    let resolve: (value: { status: "success" }) => void = () => {};

    onConfirm.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );

    const { onDeleted } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    const pending = await screen.findByRole("button", { name: /Eliminando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    resolve({ status: "success" });
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
  });
});
