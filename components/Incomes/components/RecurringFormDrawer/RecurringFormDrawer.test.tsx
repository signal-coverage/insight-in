// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createRecurringIncomeAction: vi.fn(),
  updateRecurringIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/incomes/actions", () => actions);

import type { RecurringFormTarget, RecurringRow } from "../../types";
import { RecurringFormDrawer } from "./RecurringFormDrawer";

const CATEGORIES = [
  { id: "c1", name: "Salary" },
  { id: "c2", name: "Other" },
];

const RECURRING: RecurringRow = {
  id: "rec_1",
  description: "Monthly salary",
  amount: 250000,
  currency: "USD",
  categoryId: "c1",
  categoryName: "Salary",
  notes: "Paid on the 5th",
  frequency: "WEEKLY",
  startDate: "2026-01-05",
  endDate: "2026-12-05",
  amountLabel: "$2,500.00",
  amountDecimal: "2500.00",
  frequencyLabel: "Semanal",
  nextLabel: "Próximo: 5 oct 2026",
  endLabel: "Termina el 5 dic 2026",
};

const renderForm = (recurring: RecurringRow | null) => {
  const onClose = vi.fn();
  const target: RecurringFormTarget = {
    key: 1,
    recurring,
    defaultDate: "2026-09-29",
  };

  render(
    <RecurringFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={onClose}
      target={target}
      categories={CATEGORIES}
    />,
  );

  return { onClose };
};

const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: /^(Agregar|Guardar)/ }));

// The date pickers submit ISO dates through hidden inputs, so what the form would send is the
// meaningful thing to assert (their visible segments are not one labelled input).
const formValue = (name: string) =>
  new FormData(document.querySelector("form")!).get(name);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("create mode", () => {
  it("starts with sensible defaults", () => {
    renderForm(null);

    expect(
      screen.getByRole("heading", { name: "Agregar ingreso recurrente" }),
    ).toBeInTheDocument();
    expect(formValue("startDate")).toBe("2026-09-29");
    expect(formValue("endDate")).toBe("");
    expect(
      screen.getByRole("button", { name: /Frecuencia/ }),
    ).toHaveTextContent("Mensual");
    expect(
      screen.getByRole("button", { name: "Agregar ingreso recurrente" }),
    ).toBeInTheDocument();
  });

  it("has the same plus icon on its add button as every other add action", () => {
    renderForm(null);

    const button = screen.getByRole("button", {
      name: "Agregar ingreso recurrente",
    });

    expect(button.querySelector("svg")).not.toBeNull();
  });
});

describe("edit mode", () => {
  it("prefills every field from the template", () => {
    renderForm(RECURRING);

    expect(
      screen.getByRole("heading", { name: "Editar ingreso recurrente" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Monthly salary");
    expect(screen.getByLabelText(/Monto/)).toHaveValue("2500.00");
    expect(formValue("startDate")).toBe("2026-01-05");
    expect(formValue("endDate")).toBe("2026-12-05");
    expect(screen.getByLabelText(/Notas/)).toHaveValue("Paid on the 5th");
    expect(
      screen.getByRole("button", { name: /Frecuencia/ }),
    ).toHaveTextContent("Semanal");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Salary",
    );
  });

  it("saves through the update action with the form values and closes", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderForm(RECURRING);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Salary v2" },
    });
    submit();

    await waitFor(() =>
      expect(actions.updateRecurringIncomeAction).toHaveBeenCalledTimes(1),
    );

    const [id, formData] = actions.updateRecurringIncomeAction.mock
      .calls[0] as [string, FormData];

    expect(id).toBe("rec_1");
    expect(Object.fromEntries(formData)).toMatchObject({
      description: "Salary v2",
      amount: "2500.00",
      categoryId: "c1",
      frequency: "WEEKLY",
      startDate: "2026-01-05",
      endDate: "2026-12-05",
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(actions.createRecurringIncomeAction).not.toHaveBeenCalled();
  });

  it("shows 'Saving…' with a spinner, and locks Cancel, while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.updateRecurringIncomeAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm(RECURRING);

    submit();

    const pending = await screen.findByRole("button", { name: /Guardando/ });

    expect(pending).toHaveTextContent("Guardando…");
    expect(pending.querySelector(".spinner")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();

    finish({ status: "success" });

    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /Guardando/ }),
      ).not.toBeInTheDocument(),
    );
  });

  it("shows server field errors and stays open", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        endDate: ["La fecha de fin debe ser igual o posterior a la de inicio."],
      },
    });
    const { onClose } = renderForm(RECURRING);

    submit();

    expect(
      await screen.findByText(
        "La fecha de fin debe ser igual o posterior a la de inicio.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a general error when there are no field errors", async () => {
    actions.updateRecurringIncomeAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el ingreso recurrente.",
    });

    renderForm(RECURRING);
    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró el ingreso recurrente.",
    );
  });
});
