// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BulkDeleteDialog } from "./BulkDeleteDialog";
import type { BulkDeleteCopy, BulkDeleteOutcome } from "./types";

const COPY: BulkDeleteCopy = {
  heading: (count) =>
    count === 1 ? "¿Eliminar 1 cosa?" : `¿Eliminar ${count} cosas?`,
  partialResult: (deleted, skipped) =>
    `Eliminadas ${deleted}, salteadas ${skipped}.`,
};

const renderDialog = (
  action: (ids: string[]) => Promise<BulkDeleteOutcome>,
  props: Partial<React.ComponentProps<typeof BulkDeleteDialog>> = {},
) => {
  const onClose = vi.fn();
  const onDeleting = vi.fn();
  const onDeleted = vi.fn();

  render(
    <BulkDeleteDialog
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      ids={["a", "b", "c"]}
      copy={COPY}
      action={action}
      onDeleting={onDeleting}
      onDeleted={onDeleted}
      {...props}
    />,
  );

  return { onClose, onDeleting, onDeleted };
};

const confirm = () =>
  fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

describe("BulkDeleteDialog", () => {
  it("asks how many will be deleted and warns it cannot be undone", () => {
    renderDialog(vi.fn());

    expect(screen.getByText("¿Eliminar 3 cosas?")).toBeInTheDocument();
    expect(
      screen.getByText("Esta acción no se puede deshacer."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
  });

  it("uses the singular for exactly one", () => {
    renderDialog(vi.fn(), { ids: ["a"] });

    expect(screen.getByText("¿Eliminar 1 cosa?")).toBeInTheDocument();
  });

  it("marks the rows as being deleted, then deletes them all through the action, and closes", async () => {
    const action = vi.fn().mockResolvedValue({ status: "success", deleted: 3 });
    const { onClose, onDeleting, onDeleted } = renderDialog(action);

    confirm();

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDeleting).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(action).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(action).toHaveBeenCalledTimes(1);
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onDeleting.mock.invocationCallOrder[0]).toBeLessThan(
      action.mock.invocationCallOrder[0],
    );
  });

  it("shows 'Eliminando…' with a spinner and locks Cancel while it deletes", async () => {
    let finish!: (value: BulkDeleteOutcome) => void;
    const { onClose } = renderDialog(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    confirm();

    const pending = await screen.findByRole("button", { name: /Eliminando/ });

    expect(pending).toHaveTextContent("Eliminando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    finish({ status: "success", deleted: 3 });

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps the dialog open and shows the error when the delete fails, leaving nothing marked", async () => {
    const { onClose, onDeleted } = renderDialog(
      vi.fn().mockResolvedValue({ status: "error", message: "No se pudo." }),
    );

    confirm();

    expect(await screen.findByText("No se pudo.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
    // The message lands with the end of the pending state, but under load the buttons lag a tick.
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Eliminar" })).toBeEnabled();
      expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
    });
  });

  it("shows a generic error when the action throws", async () => {
    const { onClose } = renderDialog(
      vi.fn().mockRejectedValue(new Error("network")),
    );

    confirm();

    expect(
      await screen.findByText("Algo salió mal. Inténtalo de nuevo."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open to say which ones were left out, once the rest are deleted", async () => {
    const { onClose, onDeleted } = renderDialog(
      vi.fn().mockResolvedValue({ status: "success", deleted: 1, skipped: 2 }),
    );

    confirm();

    expect(
      await screen.findByText("Eliminadas 1, salteadas 2."),
    ).toBeInTheDocument();
    expect(onDeleted).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    // Nothing left to confirm: the only way out is to close.
    expect(
      screen.queryByRole("button", { name: "Eliminar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Cerrar" }).length,
    ).toBeGreaterThan(0);
  });

  it("does not refresh anything when every one was left out", async () => {
    const { onDeleted } = renderDialog(
      vi.fn().mockResolvedValue({ status: "success", deleted: 0, skipped: 3 }),
    );

    confirm();

    expect(
      await screen.findByText("Eliminadas 0, salteadas 3."),
    ).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("closes right away when nothing was left out", async () => {
    const { onClose } = renderDialog(
      vi.fn().mockResolvedValue({ status: "success", deleted: 3, skipped: 0 }),
    );

    confirm();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
