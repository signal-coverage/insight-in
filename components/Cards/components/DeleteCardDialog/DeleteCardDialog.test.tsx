// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteCardAction: vi.fn() }));

vi.mock("@/core/cards/actions", () => actions);

import { creditCardRow } from "../../testRows";
import type { CardRow } from "../../types";
import { DeleteCardDialog } from "./DeleteCardDialog";

const CARD: CardRow = creditCardRow();

const renderDialog = (card: CardRow | null = CARD) => {
  const onClose = vi.fn();
  const onDeleting = vi.fn();

  render(
    <DeleteCardDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      onDeleting={onDeleting}
      card={card}
    />,
  );

  return { onClose, onDeleting };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteCardDialog", () => {
  it("names the card, with its brand and last four digits, and asks for confirmation", () => {
    renderDialog();

    expect(
      screen.getByText("¿Eliminar la tarjeta Visa •••• 1234?"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("says what happens to the purchases already paid with the card", () => {
    renderDialog();

    expect(
      screen.getByText(/compras en cuotas ya pagadas.*se conservan/i),
    ).toBeInTheDocument();
  });

  it("writes the brand of every card the same way as the table does", () => {
    renderDialog({ ...CARD, brandName: "Otra", title: "Otra •••• 0007" });

    expect(
      screen.getByText("¿Eliminar la tarjeta Otra •••• 0007?"),
    ).toBeInTheDocument();
  });

  it("deletes through the action and closes", async () => {
    actions.deleteCardAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteCardAction).toHaveBeenCalledWith("card_1");
  });

  it("marks the card as being deleted before it asks the server, and not at all if nothing is confirmed", async () => {
    actions.deleteCardAction.mockResolvedValue({ status: "success" });
    const { onDeleting } = renderDialog();

    expect(onDeleting).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(actions.deleteCardAction).toHaveBeenCalledWith("card_1"),
    );
    expect(onDeleting).toHaveBeenCalledWith(["card_1"]);
    expect(onDeleting.mock.invocationCallOrder[0]).toBeLessThan(
      actions.deleteCardAction.mock.invocationCallOrder[0],
    );
  });

  it("marks nothing when there is no card to delete", () => {
    const { onDeleting } = renderDialog(null);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(onDeleting).not.toHaveBeenCalled();
  });

  it("shows 'Eliminando…' with a spinner, and locks Cancel, while it deletes", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteCardAction.mockReturnValue(
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

  it("keeps the dialog open and shows why when the card still has pending expenses", async () => {
    const MESSAGE =
      "Esta tarjeta tiene gastos pendientes. Terminá de pagarlos o cambiá su tarjeta antes de eliminarla.";

    actions.deleteCardAction.mockResolvedValue({
      status: "error",
      message: MESSAGE,
    });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByText(MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
    // The button leaves its pending state a moment after the message shows up.
    expect(
      await screen.findByRole("button", { name: "Eliminar" }),
    ).toBeEnabled();
  });

  it("does nothing without a card", () => {
    renderDialog(null);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(actions.deleteCardAction).not.toHaveBeenCalled();
  });
});
