// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);

import type { ExpenseRow, FormTarget } from "../../types";
import { ExpenseFormDrawer } from "./ExpenseFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Alquiler" },
  { id: "c2", name: "Comida" },
];

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Monthly rent",
  amount: 35000050,
  currency: "ARS",
  date: "2026-01-05",
  categoryId: "c1",
  categoryName: "Alquiler",
  notes: null,
  status: "SETTLED",
  isRecurring: true,
  amountLabel: "$ 350.000,50",
  amountDecimal: "350000.50",
  dateLabel: "5 ene 2026",
};

const renderForm = (expense: ExpenseRow | null) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-09-29" };

  render(
    <ExpenseFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
    />,
  );

  return { onClose };
};

const pickCategory = async (name: string) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
    key: "ArrowDown",
  });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

// A promise the test settles by hand, to observe the form while a save is in flight.
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });

  return { promise, resolve };
};

const createdForm = (): FormData =>
  actions.createExpenseAction.mock.calls[0][0] as FormData;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("has an Add expense button with the same plus icon as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", { name: "Agregar gasto" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("starts with sensible defaults: the default currency, today, and already paid", () => {
    renderForm(null);

    expect(screen.getByRole("button", { name: /Moneda/ })).toHaveTextContent(
      "ARS",
    );
    expect(document.querySelector('input[name="date"]')).toHaveValue(
      "2026-09-29",
    );
    expect(screen.getByRole("switch", { name: "Ya pagado" })).toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).not.toBeChecked();
  });

  it("shows 'Agregando gasto…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createExpenseAction.mockReturnValue(save.promise);
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    const pending = await screen.findByRole("button", {
      name: /Agregando gasto/,
    });

    expect(pending).toHaveTextContent("Agregando gasto…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando gasto/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("sends the status and the recurring mark as the switches say", async () => {
    actions.createExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("switch", { name: "Ya pagado" }));
    fireEvent.click(screen.getByRole("switch", { name: "Gasto recurrente" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    expect(createdForm().get("status")).toBe("PLANNED");
    expect(createdForm().get("isRecurring")).toBe("true");
    expect(createdForm().get("description")).toBe("Rent");
  });

  it("shows server field errors and stays open", async () => {
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: ["El monto debe ser mayor que cero."] },
    });
    const { onClose } = renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Rent" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Alquiler");
    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText("El monto debe ser mayor que cero."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("edit mode", () => {
  it("has a plain Save changes button, without a plus", () => {
    renderForm(EXPENSE);

    expect(
      screen
        .getByRole("button", { name: "Guardar cambios" })
        .querySelector("svg"),
    ).toBeNull();
  });

  it("prefills every field from the expense", () => {
    renderForm({ ...EXPENSE, status: "PLANNED", notes: "Paid by transfer" });

    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Monthly rent");
    expect(screen.getByLabelText(/Monto/)).toHaveValue("350000.50");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Alquiler",
    );
    expect(screen.getByLabelText(/Notas/)).toHaveValue("Paid by transfer");
    expect(screen.getByRole("switch", { name: "Ya pagado" })).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Gasto recurrente" }),
    ).toBeChecked();
  });

  it("saves through the update action with the expense id and closes", async () => {
    actions.updateExpenseAction.mockResolvedValue({ status: "success" });
    const { onClose } = renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.updateExpenseAction.mock.calls[0][0]).toBe("exp_1");
    expect(
      (actions.updateExpenseAction.mock.calls[0][1] as FormData).get(
        "isRecurring",
      ),
    ).toBe("true");
  });

  it("shows 'Guardando…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.updateExpenseAction.mockReturnValue(save.promise);
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(actions.updateExpenseAction).toHaveBeenCalledTimes(1),
    );
  });

  describe("the recurring switch", () => {
    const HINT =
      "Para dejar de repetirlo, usá Gastos recurrentes y elegí Quitar.";
    const toggle = () =>
      screen.getByRole("switch", { name: "Gasto recurrente" });

    it("is on and locked, with the hint, for an expense that belongs to a template", () => {
      renderForm({ ...EXPENSE, isRecurring: true });

      expect(toggle()).toBeChecked();
      expect(toggle()).toBeDisabled();
      expect(screen.getByText(HINT)).toBeInTheDocument();
    });

    it("still sends 'true' when a linked expense is saved", async () => {
      actions.updateExpenseAction.mockResolvedValue({ status: "success" });
      const { onClose } = renderForm({ ...EXPENSE, isRecurring: true });

      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

      await waitFor(() => expect(onClose).toHaveBeenCalled());
      expect(
        (actions.updateExpenseAction.mock.calls[0][1] as FormData).get(
          "isRecurring",
        ),
      ).toBe("true");
    });

    it("is free to turn on for an expense that is not recurring, with no hint", () => {
      renderForm({ ...EXPENSE, isRecurring: false });

      expect(toggle()).not.toBeChecked();
      expect(toggle()).toBeEnabled();
      expect(screen.queryByText(HINT)).not.toBeInTheDocument();
    });
  });

  it("shows a general error when there are no field errors", async () => {
    actions.updateExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto.",
    });
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("No se encontró el gasto."),
    ).toBeInTheDocument();
  });
});
