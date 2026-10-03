// @vitest-environment jsdom
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createExpenseAction: vi.fn(),
  updateExpenseAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/expenses/actions", () => actions);

import type { CardOption, ExpenseRow, FormTarget } from "../../types";
import { ExpenseFormDrawer } from "./ExpenseFormDrawer";

const CATEGORIES = [{ id: "c1", name: "Servicios" }];

const CARD: CardOption = {
  id: "card_1",
  title: "Visa •••• 1234",
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
  charges: [],
};

// A subscription of 20 USD that really cost 35.000 ARS.
const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Netflix",
  amount: 3500000,
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "c1",
  categoryName: "Servicios",
  notes: null,
  status: "SETTLED",
  medium: "DIGITAL",
  isRecurring: false,
  installmentPlanId: null,
  installmentNumber: null,
  cardId: null,
  purchaseDate: null,
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  expectedReimbursement: null,
  reimbursementReceived: 0,
  expectedReimbursementDecimal: null,
  reimbursementTooltip: null,
  amountLabel: "$ 35.000,00",
  amountDecimal: "35000.00",
  dateLabel: "5 sept 2026",
};

const QUOTED_IN_USD: ExpenseRow = {
  ...EXPENSE,
  originCurrency: "USD",
  originAmount: 2000,
  originAmountDecimal: "20.00",
  originLabel: "Se cotizó en 20 USD",
  originTooltip: "Se cotizó en US$ 20,00 · cotización 1.750,00",
};

const renderForm = (
  expense: ExpenseRow | null,
  cards: readonly CardOption[] = [],
) => {
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-09-29" };

  render(
    <ExpenseFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      target={target}
      categories={CATEGORIES}
      cards={cards}
    />,
  );
};

// "Monto" of the expense, not the "Precio en esa moneda" of the section below it.
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

const submittedForm = async (
  action: typeof actions.createExpenseAction,
  button: string,
): Promise<FormData> => {
  action.mockResolvedValue({ status: "success" });
  fireEvent.click(screen.getByRole("button", { name: button }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));

  const { calls } = action.mock;

  return calls[0][calls[0].length - 1] as FormData;
};

beforeEach(() => {
  vi.resetAllMocks();
});

describe("origin section of the expense form", () => {
  it("is collapsed by default, so an ordinary expense never sees it", () => {
    renderForm(null);

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("textbox", { name: /Precio en esa moneda/ }),
    ).not.toBeInTheDocument();
  });

  it("opens from its heading with the expense copy: help text, currency and price labels", () => {
    renderForm(null);

    fireEvent.click(originToggle());

    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByText(
        "Si el precio estaba en otra moneda, por ejemplo 20 USD, anotalo acá. Es solo una referencia: los totales usan el monto de arriba.",
      ),
    ).toBeVisible();
    expect(originCurrencyButton()).toBeVisible();
    expect(originAmountInput()).toBeVisible();
  });

  it("stays collapsed when editing an expense that has no origin", () => {
    renderForm(EXPENSE);

    expect(originToggle()).toHaveAttribute("aria-expanded", "false");
  });

  it("opens with the stored price when editing an expense that has one", () => {
    renderForm(QUOTED_IN_USD);

    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
    expect(originAmountInput()).toHaveValue("20.00");
    expect(originCurrencyButton()).toHaveTextContent("USD");
  });

  it("offers the crypto assets first, then the currencies but the one of the expense", async () => {
    renderForm(null);

    fireEvent.click(originToggle());
    fireEvent.keyDown(originCurrencyButton(), { key: "ArrowDown" });

    const listbox = await screen.findByRole("listbox");
    const options = within(listbox)
      .getAllByRole("option")
      .map((option) => option.textContent ?? "");

    expect(within(listbox).getByText("Cripto")).toBeInTheDocument();
    expect(within(listbox).getByText("Monedas")).toBeInTheDocument();
    expect(options.slice(0, 3)).toEqual([
      "USDC - USD Coin",
      "USDT - Tether",
      "DAI - Dai",
    ]);
    expect(options[3]).toMatch(/^USD - /);
    expect(options.some((option) => option.startsWith("ARS - "))).toBe(false);
  });

  it("shows the implied rate once the real amount and the price are valid", async () => {
    renderForm(null);

    fireEvent.change(netAmountInput(), { target: { value: "35000" } });
    fireEvent.click(originToggle());

    expect(screen.queryByText(/Cotización implícita/)).not.toBeInTheDocument();

    await pickOriginCurrency(/^USD - /);
    fireEvent.change(originAmountInput(), { target: { value: "20" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /^Cotización implícita: 1 USD = \$\s1\.750,00$/,
    );
  });

  it("follows the real amount while it is edited", () => {
    renderForm(QUOTED_IN_USD);

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /= \$\s1\.750,00$/,
    );

    fireEvent.change(netAmountInput(), { target: { value: "40000" } });

    expect(screen.getByText(/Cotización implícita/).textContent).toMatch(
      /= \$\s2\.000,00$/,
    );
  });

  it("sends the price with the rest of a new expense", async () => {
    renderForm(null);

    fireEvent.change(screen.getByLabelText(/Descripción/), {
      target: { value: "Netflix" },
    });
    fireEvent.change(netAmountInput(), { target: { value: "35000" } });
    fireEvent.click(originToggle());
    await pickOriginCurrency(/^USD - /);
    fireEvent.change(originAmountInput(), { target: { value: "20" } });

    fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
      key: "ArrowDown",
    });

    const category = await screen.findByRole("option", { name: "Servicios" });

    fireEvent.keyDown(category, { key: "Enter" });
    fireEvent.keyUp(category, { key: "Enter" });

    const formData = await submittedForm(
      actions.createExpenseAction,
      "Agregar gasto",
    );

    expect(formData.get("amount")).toBe("35000");
    expect(formData.get("currency")).toBe("ARS");
    expect(formData.get("originCurrency")).toBe("USD");
    expect(formData.get("originAmount")).toBe("20");
  });

  it("sends the stored price when an expense is edited without touching it", async () => {
    renderForm(QUOTED_IN_USD);

    const formData = await submittedForm(
      actions.updateExpenseAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency")).toBe("USD");
    expect(formData.get("originAmount")).toBe("20.00");
  });

  it("sends no origin when the section was never touched", async () => {
    renderForm(EXPENSE);

    const formData = await submittedForm(
      actions.updateExpenseAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("clears the price with 'Quitar origen', and sends nothing", async () => {
    renderForm(QUOTED_IN_USD);

    fireEvent.click(screen.getByRole("button", { name: "Quitar origen" }));

    expect(originAmountInput()).toHaveValue("");
    expect(
      screen.queryByRole("button", { name: "Quitar origen" }),
    ).not.toBeInTheDocument();

    const formData = await submittedForm(
      actions.updateExpenseAction,
      "Guardar cambios",
    );

    expect(formData.get("originCurrency") ?? "").toBe("");
    expect(formData.get("originAmount") ?? "").toBe("");
  });

  it("opens by itself with the server's error on the price", async () => {
    actions.updateExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { originAmount: ["Ingresá un monto de origen válido."] },
    });
    renderForm(EXPENSE);

    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

    expect(
      await screen.findByText("Ingresá un monto de origen válido."),
    ).toBeVisible();
    expect(originToggle()).toHaveAttribute("aria-expanded", "true");
  });

  it("is still there when the expense is paid with a card", () => {
    renderForm({ ...QUOTED_IN_USD, cardId: "card_1" }, [CARD]);

    expect(originToggle()).toBeInTheDocument();
    expect(originAmountInput()).toHaveValue("20.00");
  });

  it("is never offered for an installment of a plan, which belongs to its plan", () => {
    renderForm({
      ...EXPENSE,
      description: "Heladera (3/12)",
      status: "PLANNED",
      installmentPlanId: "plan_1",
      installmentNumber: 3,
    });

    expect(
      screen.queryByRole("button", { name: /Se cotizó en otra moneda/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Precio en esa moneda/),
    ).not.toBeInTheDocument();
  });
});
