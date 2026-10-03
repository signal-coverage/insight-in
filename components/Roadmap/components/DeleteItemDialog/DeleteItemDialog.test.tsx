// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ deleteItemAction: vi.fn() }));

vi.mock("@/core/roadmap/actions", () => actions);

import type { BoardItem } from "@/core/roadmap/types";

import { DeleteItemDialog } from "./DeleteItemDialog";

const ITEM: BoardItem = {
  id: "item_1",
  title: "Modo oscuro",
  description: null,
  status: "IDEA",
  position: 1024,
  createdAt: "2026-10-04",
};

const renderDialog = (item: BoardItem | null = ITEM) => {
  const onClose = vi.fn();

  render(
    <DeleteItemDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      item={item}
    />,
  );

  return { onClose };
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("DeleteItemDialog", () => {
  it("names the card and asks for confirmation", () => {
    renderDialog();

    expect(
      screen.getByText('¿Eliminar la tarjeta "Modo oscuro"?'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
  });

  it("deletes through the action and closes", async () => {
    actions.deleteItemAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.deleteItemAction).toHaveBeenCalledWith("item_1");
  });

  it("does nothing without a card", () => {
    renderDialog(null);

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(actions.deleteItemAction).not.toHaveBeenCalled();
  });

  it("shows 'Eliminando…' with a spinner, and locks Cancel, while it deletes", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.deleteItemAction.mockReturnValue(
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

  it("keeps the dialog open and shows why when the delete fails", async () => {
    actions.deleteItemAction.mockResolvedValue({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    const { onClose } = renderDialog();

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró la tarjeta.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("button", { name: "Eliminar" }),
    ).toBeEnabled();
  });
});
