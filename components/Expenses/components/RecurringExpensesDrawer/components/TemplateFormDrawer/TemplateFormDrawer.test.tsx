// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  updateRecurringExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/recurringActions", () => ({
  updateRecurringExpenseAction: actions.updateRecurringExpenseAction,
}));
vi.mock("@/core/expenses/actions", () => ({
  createCategoryAction: actions.createCategoryAction,
}));

import type { RecurringRow } from "../../../../types";
import { TemplateFormDrawer } from "./TemplateFormDrawer";
import type { TemplateFormTarget } from "./types";

const CATEGORIES = [
  { id: "c1", name: "Alquiler" },
  { id: "c2", name: "Salud" },
];

const TEMPLATE: RecurringRow = {
  id: "rec_1",
  description: "Gym",
  amount: 4500,
  currency: "USD",
  categoryId: "c2",
  categoryName: "Salud",
  notes: "Monthly fee",
  medium: "CASH",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 20,
  decision: null,
  amountLabel: "US$ 45,00",
  amountDecimal: "45.00",
  dayLabel: "Día 20",
  originAmountDecimal: null,
  referenceLabel: null,
};

const renderForm = (template: RecurringRow | null = TEMPLATE) => {
  const onClose = vi.fn();
  const target: TemplateFormTarget = { key: 1, template };

  render(
    <TemplateFormDrawer
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
  fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

const formValue = (name: string) =>
  new FormData(document.querySelector("form")!).get(name);

beforeEach(() => {
  vi.resetAllMocks();
});

describe("the template form", () => {
  it("is titled as an edit of the recurring expense and says the change only applies from next month", () => {
    renderForm();

    expect(
      screen.getByRole("heading", { name: "Editar gasto recurrente" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Los cambios valen desde el próximo mes. El gasto de este mes se edita desde la tabla.",
      ),
    ).toBeInTheDocument();
  });

  it("prefills every field from the template", () => {
    renderForm();

    expect(screen.getByLabelText(/Descripción/)).toHaveValue("Gym");
    expect(screen.getByLabelText(/Monto/)).toHaveValue("45.00");
    expect(formValue("currency")).toBe("USD");
    expect(screen.getByRole("button", { name: /Categoría/ })).toHaveTextContent(
      "Salud",
    );
    expect(screen.getByRole("radio", { name: "Efectivo" })).toBeChecked();
    expect(screen.getByLabelText(/Día del mes/)).toHaveValue("20");
    expect(screen.getByLabelText(/Notas/)).toHaveValue("Monthly fee");
  });

  it("offers the medium like the expense form does", () => {
    renderForm();

    expect(screen.getByRole("radiogroup", { name: "Medio" })).toBeVisible();
    expect(screen.getByRole("radio", { name: "Digital" })).not.toBeChecked();
  });

  it("renders nothing to edit without a template", () => {
    renderForm(null);

    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Descripción/)).not.toBeInTheDocument();
  });
});

describe("saving", () => {
  it("sends the template's id and the form values to the update action, and closes", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "success",
    });
    const { onClose } = renderForm();

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Gym premium" },
    });
    fireEvent.change(screen.getByLabelText(/Día del mes/), {
      target: { value: "25" },
    });
    submit();

    await waitFor(() => expect(onClose).toHaveBeenCalled());

    const [id, formData] = actions.updateRecurringExpenseAction.mock
      .calls[0] as [string, FormData];

    expect(actions.updateRecurringExpenseAction).toHaveBeenCalledTimes(1);
    expect(id).toBe("rec_1");
    expect(Object.fromEntries(formData)).toMatchObject({
      description: "Gym premium",
      amount: "45.00",
      currency: "USD",
      categoryId: "c2",
      medium: "CASH",
      dayOfMonth: "25",
      notes: "Monthly fee",
    });
  });

  it("does not ask for a date or a status: it is a template, not an expense", () => {
    renderForm();

    expect(formValue("date")).toBeNull();
    expect(formValue("status")).toBeNull();
    expect(formValue("isRecurring")).toBeNull();
  });

  it("does not send a form with the description cleared", async () => {
    renderForm();

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "" },
    });
    submit();

    await Promise.resolve();
    expect(actions.updateRecurringExpenseAction).not.toHaveBeenCalled();
  });

  it("shows 'Guardando…' with a spinner, and locks Cancelar, while it saves", async () => {
    let finish!: (value: { status: "success" }) => void;

    actions.updateRecurringExpenseAction.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    renderForm();

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

  it("shows the server's field errors and stays open", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { dayOfMonth: ["Ingresá un día entre 1 y 31."] },
    });
    const { onClose } = renderForm();

    submit();

    expect(
      await screen.findByText("Ingresá un día entre 1 y 31."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows a general error when there are no field errors", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
    const { onClose } = renderForm();

    submit();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se encontró el gasto recurrente.",
    );
    expect(onClose).not.toHaveBeenCalled();
  });
});
