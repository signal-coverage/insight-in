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

const CATEGORIES = [{ id: "c1", name: "Salud" }];

const ACCOUNTS = [
  {
    id: "acc_1",
    currency: "ARS",
    label: "Banco Galicia · Caja de ahorro",
    archived: false,
  },
  {
    id: "acc_usd",
    currency: "USD",
    label: "Banco Galicia · Cuenta en dólares",
    archived: false,
  },
];

const EXPENSE: ExpenseRow = {
  id: "exp_1",
  description: "Dentista",
  amount: 1000000,
  currency: "ARS",
  date: "2026-09-12",
  categoryId: "c1",
  categoryName: "Salud",
  notes: null,
  status: "SETTLED",
  accountId: "acc_1",
  accountLabel: "Banco Galicia · Caja de ahorro",
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
  amountLabel: "$ 10.000,00",
  amountDecimal: "10000.00",
  dateLabel: "12 sept 2026",
};

const EXPECTING: ExpenseRow = {
  ...EXPENSE,
  expectedReimbursement: 400000,
  expectedReimbursementDecimal: "4000.00",
  reimbursementTooltip: "Te deben $ 4.000,00",
};

const renderForm = (expense: ExpenseRow | null) => {
  const target: FormTarget = { key: 1, expense, defaultDate: "2026-09-29" };

  render(
    <ExpenseFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      target={target}
      categories={CATEGORIES}
      cards={[]}
      accounts={ACCOUNTS}
    />,
  );
};

const reimbursementInput = () => screen.getByLabelText(/^Reintegro esperado/);

// A new expense needs a description, an amount and a category before it can be saved.
const fillNewExpense = async () => {
  fireEvent.change(screen.getByLabelText(/^Descripción/), {
    target: { value: "Dentista" },
  });
  fireEvent.change(screen.getByLabelText(/^Monto/), {
    target: { value: "10000" },
  });
  fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
    key: "ArrowDown",
  });

  const option = await screen.findByRole("option", { name: "Salud" });

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

describe("expected reimbursement field of the expense form", () => {
  it("is an optional field, empty for a new expense, that says what it is for", () => {
    renderForm(null);

    expect(reimbursementInput()).toHaveValue("");
    expect(reimbursementInput()).not.toBeRequired();
    expect(
      screen.getByText(
        "Lo que esperás que te devuelvan, en la moneda del gasto.",
      ),
    ).toBeInTheDocument();
  });

  it("sends nothing to expect when it is left empty", async () => {
    renderForm(null);
    await fillNewExpense();

    const formData = await submittedForm(
      actions.createExpenseAction,
      "Agregar gasto",
    );

    expect(formData.get("expectedReimbursement")).toBe("");
  });

  it("sends what is typed", async () => {
    renderForm(null);
    await fillNewExpense();
    fireEvent.change(reimbursementInput(), { target: { value: "4000" } });

    const formData = await submittedForm(
      actions.createExpenseAction,
      "Agregar gasto",
    );

    expect(formData.get("expectedReimbursement")).toBe("4000");
  });

  it("starts from what the expense expects when editing, and keeps it when saved untouched", async () => {
    renderForm(EXPECTING);

    expect(reimbursementInput()).toHaveValue("4000.00");

    const formData = await submittedForm(
      actions.updateExpenseAction,
      "Guardar cambios",
    );

    expect(formData.get("expectedReimbursement")).toBe("4000.00");
  });

  it("clears it when the field is emptied while editing", async () => {
    renderForm(EXPECTING);
    fireEvent.change(reimbursementInput(), { target: { value: "" } });

    const formData = await submittedForm(
      actions.updateExpenseAction,
      "Guardar cambios",
    );

    expect(formData.get("expectedReimbursement")).toBe("");
  });

  it("shows what the server said about it", async () => {
    renderForm(null);
    await fillNewExpense();
    actions.createExpenseAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { expectedReimbursement: ["Ingresá un reintegro válido."] },
    });

    fireEvent.click(screen.getByRole("button", { name: "Agregar gasto" }));

    expect(
      await screen.findByText("Ingresá un reintegro válido."),
    ).toBeInTheDocument();
  });

  it("is not offered for an installment of a plan", () => {
    renderForm({
      ...EXPENSE,
      installmentPlanId: "plan_1",
      installmentNumber: 1,
    });

    expect(screen.queryByLabelText(/^Reintegro esperado/)).toBeNull();
  });
});
