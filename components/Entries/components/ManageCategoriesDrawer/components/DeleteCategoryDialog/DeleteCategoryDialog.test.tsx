// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeleteCategoryDialog } from "./DeleteCategoryDialog";

const CATEGORY = { id: "c1", name: "Salary", count: 0 };

describe("DeleteCategoryDialog", () => {
  it("shows the category's name and a plain Delete button", () => {
    render(
      <DeleteCategoryDialog
        isOpen
        onOpenChange={() => {}}
        onClose={() => {}}
        category={CATEGORY}
        onConfirm={async () => {}}
      />,
    );

    expect(screen.getByText(/“Salary”/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar" }),
    ).toBeInTheDocument();
  });

  it("shows 'Deleting…' with a spinner, and locks Cancel, while it deletes", async () => {
    let finish!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );

    render(
      <DeleteCategoryDialog
        isOpen
        onOpenChange={() => {}}
        onClose={() => {}}
        category={CATEGORY}
        onConfirm={onConfirm}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    const pending = await screen.findByRole("button", { name: /Eliminando/ });

    expect(pending).toHaveTextContent("Eliminando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish();

    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });
});
