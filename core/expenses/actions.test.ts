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

import {
  CategoryInUseError,
  CategoryNotFoundError,
  DuplicateCategoryError,
  LastCategoryError,
} from "@/core/incomes/errors";

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
      isRecurring: true,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
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

  it("refuses to delete the last category", async () => {
    mocks.deleteCategory.mockRejectedValue(new LastCategoryError());

    expect(await deleteCategoryAction("c1")).toEqual({
      status: "error",
      message: "Se necesita al menos una categoría.",
    });
  });
});
