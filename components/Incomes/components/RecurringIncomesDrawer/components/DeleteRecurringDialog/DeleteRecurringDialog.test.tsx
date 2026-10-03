// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { RecurringRow } from "../../../../types";
import { DeleteRecurringDialog } from "./DeleteRecurringDialog";

const RECURRING: RecurringRow = {
  id: "rec_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  medium: "DIGITAL",
  frequency: "MONTHLY",
  startDate: "2026-01-05",
  endDate: null,
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  frequencyLabel: "Mensual",
  nextLabel: "Próximo: 5 oct 2026",
  endLabel: "No end date",
};

describe("DeleteRecurringDialog", () => {
  it("shows the template's name and a plain Delete button", () => {
    render(
      <DeleteRecurringDialog
        isOpen
        onOpenChange={() => {}}
        onClose={() => {}}
        recurring={RECURRING}
        onConfirm={async () => {}}
      />,
    );

    expect(screen.getByText(/“Monthly salary”/)).toBeInTheDocument();
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
      <DeleteRecurringDialog
        isOpen
        onOpenChange={() => {}}
        onClose={() => {}}
        recurring={RECURRING}
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
