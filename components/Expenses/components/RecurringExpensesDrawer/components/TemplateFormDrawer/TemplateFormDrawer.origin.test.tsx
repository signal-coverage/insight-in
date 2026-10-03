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

const CATEGORIES = [{ id: "c1", name: "Servicios" }];

// A subscription of 20 USD that really costs 35.000 ARS.
const TEMPLATE: RecurringRow = {
  id: "rec_1",
  description: "Netflix",
  amount: 3500000,
  currency: "ARS",
  categoryId: "c1",
  categoryName: "Servicios",
  notes: null,
  medium: "DIGITAL",
  originCurrency: null,
  originAmount: null,
  dayOfMonth: 5,
  decision: null,
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  dayLabel: "Día 5",
  originAmountDecimal: null,
  referenceLabel: null,
};

const WITH_REFERENCE: RecurringRow = {
  ...TEMPLATE,
  originCurrency: "USD",
  originAmount: 2000,
  originAmountDecimal: "20.00",
  referenceLabel: "Referencia: US$ 20,00",
};

const renderForm = (template: RecurringRow) => {
  render(
    <TemplateFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      target={{ key: 1, template }}
      categories={CATEGORIES}
    />,
  );
};

const netAmountInput = () => screen.getByLabelText(/^Monto/);

const originToggle = () =>
  screen.getByRole("button", { name: /Se cotizó en otra moneda/ });

const originAmountInput = () => screen.getByLabelText(/Precio en esa moneda/);

const originCurrencyButton = () =>
  screen.getByRole("button", { name: /Moneda del precio/ });

const pickOriginCurrency = async (name: string | RegExp) => {
  fireEvent.keyDown(originCurrencyButton(), { key: "ArrowDown" });

  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const submittedForm = async (): Promise<FormData> => {
  actions.updateRecurringExpenseAction.mockResolvedValue({ status: "success" });
  fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));
  await waitFor(() =>
    expect(actions.updateRecurringExpenseAction).toHaveBeenCalledTimes(1),
  );

  return actions.updateRecurringExpenseAction.mock.calls[0][1] as FormData;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("origin section of the template form", () => {
  it("is collapsed for a template without a reference price", () => {
    renderForm(TEMPLATE);

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with the stored reference price of the template", () => {
    renderForm(WITH_REFERENCE);

    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
    expect(originAmountInput()).toHaveValue("20.00");
    expect(originCurrencyButton()).toHaveTextContent("USD");
  });

  it("shows the implied rate and follows the amount of the template", () => {
    renderForm(WITH_REFERENCE);

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /^Cotización implícita: 1 USD = \$\s1\.750,00$/,
    );

    fireEvent.change(netAmountInput(), { target: { value: "40000" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /= \$\s2\.000,00$/,
    );
  });

  it("sets a reference price on a template that had none", async () => {
    renderForm(TEMPLATE);

    fireEvent.click(originToggle());
    await pickOriginCurrency(/^USD - /);
    fireEvent.change(originAmountInput(), { target: { value: "20" } });

    const formData = await submittedForm();

    expect(formData.get("originCurrency")).toBe("USD");
    expect(formData.get("originAmount")).toBe("20");
  });

  it("keeps the stored reference price when the section is not touched", async () => {
    renderForm(WITH_REFERENCE);

    const formData = await submittedForm();

    expect(formData.get("originCurrency")).toBe("USD");
    expect(formData.get("originAmount")).toBe("20.00");
  });

  it("clears the reference price with 'Quitar origen', and sends nothing", async () => {
    renderForm(WITH_REFERENCE);

    fireEvent.click(screen.getByRole("button", { name: "Quitar origen" }));

    const formData = await submittedForm();

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("sends no reference price for a template that never had one", async () => {
    renderForm(TEMPLATE);

    const formData = await submittedForm();

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("opens by itself with the server's error on the reference price", async () => {
    actions.updateRecurringExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { originCurrency: ["Elegí la moneda de origen."] },
    });
    renderForm(TEMPLATE);

    fireEvent.click(screen.getByRole("button", { name: /Guardar cambios/ }));

    expect(await screen.findByText("Elegí la moneda de origen.")).toBeVisible();
    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
  });
});
