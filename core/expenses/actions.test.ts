import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  deleteExpense: vi.fn(),
  setExpenseStatus: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createExpense: mocks.createExpense,
  updateExpense: mocks.updateExpense,
  deleteExpense: mocks.deleteExpense,
  setExpenseStatus: mocks.setExpenseStatus,
  createCategory: mocks.createCategory,
  renameCategory: mocks.renameCategory,
  deleteCategory: mocks.deleteCategory,
}));

import { AccountArchivedError } from "@/core/accounts/errors";
import { InstallmentCurrencyLockedError } from "@/core/entries/errors";
import {
  CardBankWithoutAccountError,
  CardCurrencyMismatchError,
  CardNotFoundError,
} from "@/core/cards/errors";
import {
  EXPECTED_REIMBURSEMENT_MESSAGE,
  EXPENSE_CURRENCY_LOCKED_MESSAGE,
  REIMBURSEMENT_LOCKED_MESSAGE,
} from "@/core/reimbursements/consts";
import {
  ExpenseCurrencyLockedError,
  ReimbursementLockedError,
} from "@/core/reimbursements/errors";
import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "@/core/incomes/errors";

import {
  ExpenseAccountRequiredError,
  ExpenseChangedError,
  ExpenseFutureDebitError,
  ExpenseInsufficientFundsError,
} from "./errors";
import {
  createCategoryAction,
  createExpenseAction,
  deleteCategoryAction,
  deleteExpenseAction,
  renameCategoryAction,
  setExpenseStatusAction,
  updateExpenseAction,
} from "./actions";

const USER_ID = "user_123";

const buildFormData = (overrides: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    description: "Monthly rent",
    amount: "350000.50",
    currency: "ARS",
    date: "2026-09-05",
    categoryId: "cat_1",
    accountId: "acc_1",
    notes: "",
    status: "SETTLED",
    isRecurring: "true",
    ...overrides,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createExpenseAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createExpenseAction(
      buildFormData({ amount: "abc", categoryId: "" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual(
      expect.objectContaining({
        amount: expect.any(Array),
        categoryId: expect.any(Array),
      }),
    );
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("creates the expense for the authenticated user and revalidates the page", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "success",
    });
    expect(mocks.createExpense).toHaveBeenCalledWith(USER_ID, {
      description: "Monthly rent",
      amount: 35000050,
      currency: "ARS",
      date: "2026-09-05",
      categoryId: "cat_1",
      notes: null,
      status: "SETTLED",
      accountId: "acc_1",
      isRecurring: true,
      cardId: null,
      originCurrency: null,
      originAmount: null,
      expectedReimbursement: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("passes on the price in another currency the form sends, in minor units", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(
      buildFormData({ originCurrency: "USD", originAmount: "20" }),
    );

    expect(mocks.createExpense.mock.calls[0][1]).toMatchObject({
      amount: 35000050,
      currency: "ARS",
      originCurrency: "USD",
      originAmount: 2000,
    });
  });

  it("returns field errors for an incomplete origin without touching the service", async () => {
    const result = await createExpenseAction(
      buildFormData({ originAmount: "20" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      originCurrency: ["Elegí la moneda de origen."],
    });
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("clears the origin on update when the form sends it empty", async () => {
    mocks.updateExpense.mockResolvedValue(true);

    await updateExpenseAction(
      "exp_1",
      buildFormData({ originCurrency: "", originAmount: "" }),
    );

    expect(mocks.updateExpense.mock.calls[0][2]).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });

  it("sets an origin on update", async () => {
    mocks.updateExpense.mockResolvedValue(true);

    await updateExpenseAction(
      "exp_1",
      buildFormData({ originCurrency: "USDT", originAmount: "20" }),
    );

    expect(mocks.updateExpense.mock.calls[0][2]).toMatchObject({
      originCurrency: "USDT",
      originAmount: 20000000,
    });
  });

  it("passes on the card the form sends", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(buildFormData({ cardId: "card_1" }));

    expect(mocks.createExpense.mock.calls[0][1].cardId).toBe("card_1");
  });

  it("passes on the card when an expense is edited", async () => {
    mocks.updateExpense.mockResolvedValue(true);

    await updateExpenseAction("exp_1", buildFormData({ cardId: "card_1" }));

    expect(mocks.updateExpense.mock.calls[0][2].cardId).toBe("card_1");
  });

  it("maps a card that is not the user's to a cardId field error", async () => {
    mocks.createExpense.mockRejectedValue(new CardNotFoundError());

    const result = await createExpenseAction(
      buildFormData({ cardId: "card_9" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: ["No se encontró la tarjeta."],
    });
  });

  it("maps a card in another currency to a cardId field error", async () => {
    mocks.createExpense.mockRejectedValue(new CardCurrencyMismatchError());

    const result = await createExpenseAction(
      buildFormData({ cardId: "card_1" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: ["La tarjeta no tiene un tope en la moneda de la compra."],
    });
  });

  it("passes on the reimbursement the form expects, in minor units", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(buildFormData({ expectedReimbursement: "4000" }));

    expect(mocks.createExpense.mock.calls[0][1].expectedReimbursement).toBe(
      400000,
    );
  });

  it("rejects an expected reimbursement that is not a positive amount, without writing", async () => {
    const result = await createExpenseAction(
      buildFormData({ expectedReimbursement: "0" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      expectedReimbursement: [EXPECTED_REIMBURSEMENT_MESSAGE],
    });
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("maps a currency change refused because of linked incomes to a currency field error", async () => {
    mocks.updateExpense.mockRejectedValue(new ExpenseCurrencyLockedError());

    const result = await updateExpenseAction("exp_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [EXPENSE_CURRENCY_LOCKED_MESSAGE],
    });
  });

  it("maps a currency change on an installment to the currency field, and lets a plain save through", async () => {
    mocks.updateExpense.mockRejectedValue(new InstallmentCurrencyLockedError());

    const refused = await updateExpenseAction("exp_1", buildFormData());

    expect(refused.status === "error" && refused.fieldErrors).toEqual({
      currency: ["Una cuota conserva la moneda de su plan."],
    });

    mocks.updateExpense.mockResolvedValue(true);

    expect(await updateExpenseAction("exp_1", buildFormData())).toEqual({
      status: "success",
    });
  });

  it("maps clearing a reimbursement refused because of linked incomes to its field error", async () => {
    mocks.updateExpense.mockRejectedValue(new ReimbursementLockedError());

    const result = await updateExpenseAction("exp_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      expectedReimbursement: [REIMBURSEMENT_LOCKED_MESSAGE],
    });
  });

  it("passes on the account the form sends", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(buildFormData({ accountId: "acc_9" }));

    expect(mocks.createExpense.mock.calls[0][1].accountId).toBe("acc_9");
  });

  it("refuses a form without an account, without touching the service", async () => {
    const result = await createExpenseAction(buildFormData({ accountId: "" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      accountId: ["Elegí una cuenta."],
    });
    expect(mocks.createExpense).not.toHaveBeenCalled();
  });

  it("puts an archived account refused by the service on the Cuenta field", async () => {
    mocks.updateExpense.mockRejectedValue(new AccountArchivedError());

    const result = await updateExpenseAction("exp_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      accountId: [
        "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
      ],
    });
  });

  it("ignores a userId submitted in the form", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(buildFormData({ userId: "attacker" }));

    expect(mocks.createExpense.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createExpense.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("maps a foreign category to a categoryId field error", async () => {
    mocks.createExpense.mockRejectedValue(new CategoryNotFoundError());

    const result = await createExpenseAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createExpense.mockRejectedValue(new Error("connection refused"));

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateExpenseAction", () => {
  it("updates through the service scoped to the user and revalidates", async () => {
    mocks.updateExpense.mockResolvedValue(true);

    expect(await updateExpenseAction("exp_1", buildFormData())).toEqual({
      status: "success",
    });
    expect(mocks.updateExpense).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      expect.any(Object),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("reports a missing record", async () => {
    mocks.updateExpense.mockResolvedValue(false);

    expect(await updateExpenseAction("exp_9", buildFormData())).toEqual({
      status: "error",
      message: "No se encontró el gasto.",
    });
  });
});

describe("COVERED on any expense", () => {
  it("is created without a field error when the form sends it", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    expect(
      await createExpenseAction(buildFormData({ status: "COVERED" })),
    ).toEqual({ status: "success" });
    expect(mocks.createExpense.mock.calls[0][1].status).toBe("COVERED");
  });

  it("is saved without a field error when the form edits an expense", async () => {
    mocks.updateExpense.mockResolvedValue(true);

    expect(
      await updateExpenseAction(
        "exp_1",
        buildFormData({ status: "COVERED", isRecurring: "false" }),
      ),
    ).toEqual({ status: "success" });
    expect(mocks.updateExpense.mock.calls[0][2].status).toBe("COVERED");
  });

  it("is set without a field error when the status action asks for it", async () => {
    mocks.setExpenseStatus.mockResolvedValue(true);

    expect(await setExpenseStatusAction("exp_1", "COVERED")).toEqual({
      status: "success",
    });
    expect(mocks.setExpenseStatus).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      "COVERED",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });
});

describe("setExpenseStatusAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect((await setExpenseStatusAction("exp_1", "SETTLED")).status).toBe(
      "error",
    );
    expect(mocks.setExpenseStatus).not.toHaveBeenCalled();
  });

  it("changes the status through the service scoped to the user and revalidates", async () => {
    mocks.setExpenseStatus.mockResolvedValue(true);

    expect(await setExpenseStatusAction("exp_1", "PLANNED")).toEqual({
      status: "success",
    });
    expect(mocks.setExpenseStatus).toHaveBeenCalledWith(
      USER_ID,
      "exp_1",
      "PLANNED",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("refuses a status that does not exist without touching the service", async () => {
    expect(
      (await setExpenseStatusAction("exp_1", "DONE" as never)).status,
    ).toBe("error");
    expect(mocks.setExpenseStatus).not.toHaveBeenCalled();
  });

  it("reports a missing record", async () => {
    mocks.setExpenseStatus.mockResolvedValue(false);

    expect(await setExpenseStatusAction("exp_9", "SETTLED")).toEqual({
      status: "error",
      message: "No se encontró el gasto.",
    });
  });
});

describe("deleteExpenseAction", () => {
  it("deletes through the service scoped to the user and revalidates", async () => {
    mocks.deleteExpense.mockResolvedValue(true);

    expect(await deleteExpenseAction("exp_1")).toEqual({ status: "success" });
    expect(mocks.deleteExpense).toHaveBeenCalledWith(USER_ID, "exp_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("reports a missing record", async () => {
    mocks.deleteExpense.mockResolvedValue(false);

    expect((await deleteExpenseAction("exp_9")).status).toBe("error");
  });
});

describe("createCategoryAction", () => {
  it("creates the category and revalidates", async () => {
    mocks.createCategory.mockResolvedValue({ id: "c1", name: "Mascotas" });

    expect(await createCategoryAction("Mascotas")).toEqual({
      status: "success",
      category: { id: "c1", name: "Mascotas" },
    });
    expect(mocks.createCategory).toHaveBeenCalledWith(USER_ID, "Mascotas");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("validates the name before touching the service", async () => {
    const result = await createCategoryAction("   ");

    expect(result.status === "error" && result.fieldErrors?.name).toBeDefined();
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });

  it("maps a duplicate to a name field error", async () => {
    mocks.createCategory.mockRejectedValue(new DuplicateCategoryError());

    const result = await createCategoryAction("Comida");

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["Ya tienes una categoría con este nombre."],
    });
  });

  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect((await createCategoryAction("Comida")).status).toBe("error");
  });
});

describe("renameCategoryAction", () => {
  it("renames and revalidates", async () => {
    mocks.renameCategory.mockResolvedValue({ id: "c1", name: "Super" });

    expect(await renameCategoryAction("c1", "Super")).toEqual({
      status: "success",
      category: { id: "c1", name: "Super" },
    });
    expect(mocks.renameCategory).toHaveBeenCalledWith(USER_ID, "c1", "Super");
  });

  it("reports a missing category with a plain message", async () => {
    mocks.renameCategory.mockRejectedValue(new CategoryNotFoundError());

    expect(await renameCategoryAction("c9", "Super")).toEqual({
      status: "error",
      message: "No se encontró la categoría.",
    });
  });
});

describe("deleteCategoryAction", () => {
  it("deletes and revalidates", async () => {
    mocks.deleteCategory.mockResolvedValue(undefined);

    expect(await deleteCategoryAction("c1")).toEqual({ status: "success" });
    expect(mocks.deleteCategory).toHaveBeenCalledWith(USER_ID, "c1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it.each([
    [1, "1 gasto todavía usa esta categoría. Muévelo o elimínalo primero."],
    [3, "3 gastos todavía usan esta categoría. Muévelos o elimínalos primero."],
  ])(
    "explains that %i expenses still use the category",
    async (count, message) => {
      mocks.deleteCategory.mockRejectedValue(new CategoryInUseError(count, 0));

      expect(await deleteCategoryAction("c1")).toEqual({
        status: "error",
        message,
      });
    },
  );

  it.each([
    [
      0,
      1,
      "1 gasto recurrente todavía usa esta categoría. Muévelo o elimínalo primero.",
    ],
    [
      2,
      1,
      "2 gastos y 1 gasto recurrente todavía usan esta categoría. Muévelos o elimínalos primero.",
    ],
    [
      0,
      3,
      "3 gastos recurrentes todavía usan esta categoría. Muévelos o elimínalos primero.",
    ],
  ])(
    "also counts the recurring expenses that use the category (%i, %i)",
    async (count, recurringCount, message) => {
      mocks.deleteCategory.mockRejectedValue(
        new CategoryInUseError(count, recurringCount),
      );

      expect(await deleteCategoryAction("c1")).toEqual({
        status: "error",
        message,
      });
    },
  );

  it.each([
    [
      0,
      0,
      1,
      "1 compra en cuotas todavía usa esta categoría. Muévela o elimínala primero.",
    ],
    [
      0,
      0,
      2,
      "2 compras en cuotas todavía usan esta categoría. Muévelas o elimínalas primero.",
    ],
    [
      12,
      0,
      1,
      "12 gastos y 1 compra en cuotas todavía usan esta categoría. Muévelos o elimínalos primero.",
    ],
    [
      2,
      1,
      1,
      "2 gastos, 1 gasto recurrente y 1 compra en cuotas todavía usan esta categoría. Muévelos o elimínalos primero.",
    ],
  ])(
    "also counts the installment plans that use the category (%i, %i, %i)",
    async (count, recurringCount, installmentCount, message) => {
      mocks.deleteCategory.mockRejectedValue(
        new CategoryInUseError(count, recurringCount, installmentCount),
      );

      expect(await deleteCategoryAction("c1")).toEqual({
        status: "error",
        message,
      });
    },
  );

  it("refuses to delete the last category", async () => {
    mocks.deleteCategory.mockRejectedValue(new LastCategoryError());

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message: "Se necesita al menos una categoría.",
    });
  });
});

describe("the refusals of a debit card's expense", () => {
  const FUNDS =
    /^La cuenta no tiene fondos suficientes para este gasto: tenía \$\s300,00\.$/;

  it("puts an account that cannot cover a paid expense under Monto, and refreshes nothing", async () => {
    mocks.createExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [expect.stringMatching(FUNDS)] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the same refusal under Monto on an edit", async () => {
    mocks.updateExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    const result = await updateExpenseAction("exp_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      amount: [expect.stringMatching(FUNDS)],
    });
  });

  it("puts a bank without an account in the currency under Tarjeta, pointing to Bancos", async () => {
    mocks.createExpense.mockRejectedValue(
      new CardBankWithoutAccountError("EUR"),
    );

    const result = await createExpenseAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: [
        "El banco de esta tarjeta no tiene una cuenta activa en EUR. Creá una en Bancos.",
      ],
    });
  });

  it("asks for the account of a credit card's expense under Cuenta", async () => {
    mocks.createExpense.mockRejectedValue(new ExpenseAccountRequiredError());

    const result = await createExpenseAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      accountId: ["Elegí una cuenta."],
    });
  });

  it("sends a debit card's expense with no account to the service", async () => {
    const formData = buildFormData({ cardId: "card_9" });

    formData.delete("accountId");
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    expect(await createExpenseAction(formData)).toEqual({ status: "success" });
    expect(mocks.createExpense.mock.calls[0][1]).toMatchObject({
      cardId: "card_9",
      accountId: null,
    });
  });

  it("says why a debit expense cannot be marked paid as a plain message, the checkbox having no fields", async () => {
    mocks.setExpenseStatus.mockRejectedValue(
      new ExpenseInsufficientFundsError(30000, "ARS"),
    );

    expect(await setExpenseStatusAction("exp_1", "SETTLED")).toEqual({
      status: "error",
      message: expect.stringMatching(FUNDS),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("ids that are not text", () => {
  it("are refused by the edit and the status before the service is called", async () => {
    expect(
      await updateExpenseAction(undefined as never, buildFormData()),
    ).toEqual({ status: "error", message: "No se encontró el gasto." });
    expect(await setExpenseStatusAction(undefined as never, "SETTLED")).toEqual(
      { status: "error", message: "No se encontró el gasto." },
    );
    expect(mocks.updateExpense).not.toHaveBeenCalled();
    expect(mocks.setExpenseStatus).not.toHaveBeenCalled();
  });
});

describe("an expense that changed while it was saved", () => {
  const CHANGED = "El gasto cambió mientras lo guardabas. Volvé a intentarlo.";

  it("is a general error on create and edit, refreshing nothing", async () => {
    mocks.createExpense.mockRejectedValue(new ExpenseChangedError());
    mocks.updateExpense.mockRejectedValue(new ExpenseChangedError());

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: CHANGED,
    });
    expect(await updateExpenseAction("exp_1", buildFormData())).toEqual({
      status: "error",
      message: CHANGED,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("is a plain message on the status checkbox, refreshing nothing", async () => {
    mocks.setExpenseStatus.mockRejectedValue(new ExpenseChangedError());

    expect(await setExpenseStatusAction("exp_1", "SETTLED")).toEqual({
      status: "error",
      message: CHANGED,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("is told apart from a missing expense", async () => {
    mocks.updateExpense.mockResolvedValue(false);

    expect(await updateExpenseAction("exp_1", buildFormData())).toEqual({
      status: "error",
      message: "No se encontró el gasto.",
    });
  });
});

describe("a paid debit expense dated in the future", () => {
  const FUTURE =
    "Un gasto pagado con débito no puede tener fecha posterior a hoy. Usá la fecha de hoy o dejalo por pagar.";

  it("puts the refusal under Fecha on create and edit, and as a plain message on the checkbox", async () => {
    mocks.createExpense.mockRejectedValue(new ExpenseFutureDebitError());
    mocks.updateExpense.mockRejectedValue(new ExpenseFutureDebitError());
    mocks.setExpenseStatus.mockRejectedValue(new ExpenseFutureDebitError());

    expect(await createExpenseAction(buildFormData())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { date: [FUTURE] },
    });
    const edited = await updateExpenseAction("exp_1", buildFormData());

    expect(edited.status === "error" && edited.fieldErrors).toEqual({
      date: [FUTURE],
    });
    expect(await setExpenseStatusAction("exp_1", "SETTLED")).toEqual({
      status: "error",
      message: FUTURE,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("deleteExpenseAction with an id that is not text", () => {
  it.each([
    ["undefined", undefined],
    ["an empty id", ""],
    ["a number", 7],
    ["null", null],
  ])(
    "refuses %s before the service is called, so no filter is ever dropped",
    async (_label, id) => {
      expect(await deleteExpenseAction(id as never)).toEqual({
        status: "error",
        message: "No se encontró el gasto.",
      });
      expect(mocks.deleteExpense).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("still deletes a real id", async () => {
    mocks.deleteExpense.mockResolvedValue(true);

    expect(await deleteExpenseAction("exp_1")).toEqual({ status: "success" });
    expect(mocks.deleteExpense).toHaveBeenCalledWith(USER_ID, "exp_1");
  });
});

describe("an expense in a crypto currency", () => {
  it("hands the service the amount in millionths", async () => {
    mocks.createExpense.mockResolvedValue({ id: "exp_1" });

    await createExpenseAction(
      buildFormData({ currency: "USDC", amount: "1.5" }),
    );

    expect(mocks.createExpense.mock.calls[0][1]).toMatchObject({
      currency: "USDC",
      amount: 1500000,
    });
  });

  it("says what a wallet's account held when its debit card cannot cover the expense", async () => {
    mocks.createExpense.mockRejectedValue(
      new ExpenseInsufficientFundsError(1500000, "USDC"),
    );

    const result = await createExpenseAction(
      buildFormData({ currency: "USDC", amount: "2" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      amount: [
        "La cuenta no tiene fondos suficientes para este gasto: tenía 1,50 USDC.",
      ],
    });
  });
});
