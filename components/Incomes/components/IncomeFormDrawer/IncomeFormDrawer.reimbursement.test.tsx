// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  createIncomeAction: vi.fn(),
  updateIncomeAction: vi.fn(),
  createCategoryAction: vi.fn(),
}));

vi.mock("@/core/incomes/actions", () => actions);

import type { FormTarget, IncomeRow, ReimbursableOption } from "../../types";
import { IncomeFormDrawer } from "./IncomeFormDrawer";

const CATEGORIES = [{ id: "c1", name: "Otros" }];

const REIMBURSABLES: ReimbursableOption[] = [
  {
    id: "exp_1",
    currency: "ARS",
    label: "Dentista · 12/09 · faltan $ 4.000,00",
  },
  {
    id: "exp_2",
    currency: "USD",
    label: "Préstamo a Juan · 01/08 · faltan US$ 50,00",
  },
];

const INCOME: IncomeRow = {
  id: "inc_1",
  description: "Reintegro obra social",
  amount: 600000,
  currency: "ARS",
  date: "2026-09-20",
  categoryId: "c1",
  categoryName: "Otros",
  notes: null,
  recurringIncomeId: null,
  installmentPlanId: null,
  installmentNumber: null,
  status: "SETTLED",
  medium: "DIGITAL",
  amountLabel: "$ 6.000,00",
  amountDecimal: "6000.00",
  dateLabel: "20 sept 2026",
  originCurrency: null,
  originAmount: null,
  originAmountDecimal: null,
  originLabel: null,
  originTooltip: null,
  reimbursesExpenseId: null,
  reimbursesExpenseDescription: null,
  reimbursementTooltip: null,
};

const LINKED: IncomeRow = {
  ...INCOME,
  reimbursesExpenseId: "exp_1",
  reimbursesExpenseDescription: "Dentista",
  reimbursementTooltip: "Devolución de: Dentista",
};

const renderForm = (
  income: IncomeRow | null,
  reimbursables: readonly ReimbursableOption[] = REIMBURSABLES,
) => {
  const target: FormTarget = { key: 1, income, defaultDate: "2026-09-29" };

  render(
    <IncomeFormDrawer
      isOpen
      onOpenChange={() => {}}
      onClose={() => {}}
      target={target}
      categories={CATEGORIES}
      reimbursables={reimbursables}
    />,
  );
};

const reimbursesButton = () =>
  screen.getByRole("button", { name: /Es devolución de un gasto/ });

const queryReimbursesButton = () =>
  screen.queryByRole("button", { name: /Es devolución de un gasto/ });

const openReimburses = () =>
  fireEvent.keyDown(reimbursesButton(), { key: "ArrowDown" });

const pick = async (name: string | RegExp) => {
  const option = await screen.findByRole("option", { name });

  fireEvent.keyDown(option, { key: "Enter" });
  fireEvent.keyUp(option, { key: "Enter" });
};

const pickCurrency = async (name: string | RegExp) => {
  fireEvent.keyDown(screen.getByRole("button", { name: /Moneda$/ }), {
    key: "ArrowDown",
  });
  await pick(name);
};

// A new income needs a description, an amount and a category before it can be saved.
const fillNewIncome = async () => {
  fireEvent.change(screen.getByLabelText(/^Descripción/), {
    target: { value: "Reintegro obra social" },
  });
  fireEvent.change(screen.getByLabelText(/^Monto(?! de origen)/), {
    target: { value: "6000" },
  });
  fireEvent.keyDown(screen.getByRole("button", { name: /Categoría/ }), {
    key: "ArrowDown",
  });
  await pick("Otros");
};

const submittedForm = async (
  action: typeof actions.createIncomeAction,
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

describe("reimbursed expense field of the income form", () => {
  it("lists only the expenses in the currency of the income, after the 'not a reimbursement' choice", async () => {
    renderForm(null);
    openReimburses();

    const options = await screen.findAllByRole("option");
    const names = options.map((option) => option.textContent);

    expect(names).toContain("No es una devolución");
    expect(names).toContain("Dentista · 12/09 · faltan $ 4.000,00");
    expect(names).not.toContain("Préstamo a Juan · 01/08 · faltan US$ 50,00");
  });

  it("is not offered when no expense in that currency expects money", () => {
    renderForm(null, [REIMBURSABLES[1]]);

    expect(queryReimbursesButton()).toBeNull();
  });

  it("is not offered when the user has no such expense at all", () => {
    renderForm(null, []);

    expect(queryReimbursesButton()).toBeNull();
  });

  it("pays nothing back by default", async () => {
    renderForm(null);
    await fillNewIncome();

    const formData = await submittedForm(
      actions.createIncomeAction,
      "Agregar ingreso",
    );

    expect(formData.get("reimbursesExpenseId")).toBe("");
  });

  it("sends the expense that was picked", async () => {
    renderForm(null);
    await fillNewIncome();
    openReimburses();
    await pick(/^Dentista/);

    const formData = await submittedForm(
      actions.createIncomeAction,
      "Agregar ingreso",
    );

    expect(formData.get("reimbursesExpenseId")).toBe("exp_1");
  });

  it("can be undone with 'No es una devolución'", async () => {
    renderForm(LINKED);
    openReimburses();
    await pick("No es una devolución");

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("reimbursesExpenseId")).toBe("");
  });

  it("starts from the expense the income already pays back, and keeps it when saved untouched", async () => {
    renderForm(LINKED);

    expect(reimbursesButton()).toHaveTextContent("Dentista · 12/09");

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("reimbursesExpenseId")).toBe("exp_1");
  });

  it("keeps offering the expense an income pays back once nothing is owed on it any more", async () => {
    // The expense is not among the ones that still expect money: this income completed it.
    renderForm(LINKED, []);

    expect(reimbursesButton()).toHaveTextContent(
      "Dentista · reintegro completo",
    );

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("reimbursesExpenseId")).toBe("exp_1");
  });

  it("drops a choice that does not fit when the currency changes, and sends none", async () => {
    renderForm(LINKED);

    await pickCurrency(/^USD/);

    const formData = await submittedForm(
      actions.updateIncomeAction,
      "Guardar cambios",
    );

    expect(formData.get("currency")).toBe("USD");
    expect(formData.get("reimbursesExpenseId")).toBe("");
  });

  it("is not offered for an installment of a loan repaid in cuotas", () => {
    renderForm({
      ...INCOME,
      installmentPlanId: "plan_1",
      installmentNumber: 1,
    });

    expect(queryReimbursesButton()).toBeNull();
  });

  it("shows what the server said about the choice", async () => {
    renderForm(null);
    await fillNewIncome();
    actions.createIncomeAction.mockResolvedValue({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        reimbursesExpenseId: ["Ese gasto no espera un reintegro."],
      },
    });

    fireEvent.click(screen.getByRole("button", { name: "Agregar ingreso" }));

    expect(
      await screen.findByText("Ese gasto no espera un reintegro."),
    ).toBeInTheDocument();
  });
});
