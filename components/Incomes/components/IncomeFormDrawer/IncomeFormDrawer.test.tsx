// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createIncomeAction: vi.fn(),
  updateIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/incomes/actions", () => actions);

import type { FormTarget, IncomeRow } from "../../types";
import { IncomeFormDrawer } from "./IncomeFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Salary" },
  { id: "c2", name: "Other" },
];

const INCOME: IncomeRow = {
  id: "inc_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  date: "2026-01-05",
  categoryId: "c1",
  categoryName: "Salary",
  notes: null,
  recurringIncomeId: null,
  status: "SETTLED",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  dateLabel: "5 ene 2026",
};

const renderForm = (income: IncomeRow | null) => {
  const onClose = vi.fn();
  const target: FormTarget = { key: 1, income, defaultDate: "2026-09-29" };

  render(
    <IncomeFormDrawer
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

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("has an Add income button with the same plus icon as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", { name: "Agregar ingreso" });

    expect(button.querySelector("svg")).not.toBeNull();
    expect(button).toHaveAttribute("type", "submit");
  });

  it("shows 'Adding income…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.createIncomeAction.mockReturnValue(save.promise);
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Salary" },
    });
    fireEvent.change(screen.getByLabelText(/Monto/), {
      target: { value: "10" },
    });
    await pickCategory("Salary");
    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    const pending = await screen.findByRole("button", {
      name: /Agregando ingreso/,
    });

    expect(pending).toHaveTextContent("Agregando ingreso…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(pending.querySelector("svg.size-4[aria-hidden]")).toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Agregando ingreso/ }),
      ).not.toBeInTheDocument(),
    );
  });
});

describe("edit mode", () => {
  it("has a plain Save changes button, without a plus", () => {
    renderForm(INCOME);

    const button = screen.getByRole("button", { name: "Guardar cambios" });

    expect(button.querySelector("svg")).toBeNull();
  });

  it("shows 'Saving…' with a spinner, and locks Cancel, while it saves", async () => {
    const save = deferred<{ status: "success" }>();

    actions.updateIncomeAction.mockReturnValue(save.promise);
    renderForm(INCOME);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending).toHaveTextContent("Guardando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    save.resolve({ status: "success" });

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );
  });
});

describe("status switch", () => {
  const settledSwitch = () =>
    screen.getByRole("switch", { name: "Ya cobrado" });

  it("starts on for a new income, since the money usually has already arrived", () => {
    renderForm(null);

    expect(settledSwitch()).toBeChecked();
  });

  it("follows the status of the income being edited", () => {
    renderForm({ ...INCOME, status: "PLANNED" });

    expect(settledSwitch()).not.toBeChecked();
  });

  it("sends the chosen status with the rest of the form", async () => {
    actions.updateIncomeAction.mockResolvedValue({ status: "success" });
    renderForm(INCOME);

    fireEvent.click(settledSwitch());
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() =>
      expect(actions.updateIncomeAction).toHaveBeenCalledTimes(1),
    );

    const formData = actions.updateIncomeAction.mock.calls[0][1] as FormData;

    expect(formData.get("status")).toBe("PLANNED");
  });
});
