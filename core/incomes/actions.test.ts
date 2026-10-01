import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
  setIncomeStatus: vi.fn(),
  createCategory: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createIncome: mocks.createIncome,
  updateIncome: mocks.updateIncome,
  deleteIncome: mocks.deleteIncome,
  setIncomeStatus: mocks.setIncomeStatus,
  createCategory: mocks.createCategory,
}));

import {
  createCategoryAction,
  createIncomeAction,
  deleteIncomeAction,
  setIncomeStatusAction,
  updateIncomeAction,
} from "./actions";
import { CategoryNotFoundError, DuplicateCategoryError } from "./errors";

const USER_ID = "user_123";

const buildFormData = (overrides: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    description: "September salary",
    amount: "1500.50",
    currency: "USD",
    date: "2026-09-01",
    categoryId: "cat_1",
    notes: "",
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

describe("createIncomeAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await createIncomeAction(buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createIncome).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createIncomeAction(
      buildFormData({ amount: "abc", categoryId: "" }),
    );

    expect(result.status).toBe("error");
    expect(result.status === "error" && result.fieldErrors).toEqual(
      expect.objectContaining({
        amount: expect.any(Array),
        categoryId: expect.any(Array),
      }),
    );
    expect(mocks.createIncome).not.toHaveBeenCalled();
  });

  it("creates the income for the authenticated user and revalidates the page", async () => {
    mocks.createIncome.mockResolvedValue({ id: "inc_1" });

    const result = await createIncomeAction(buildFormData());

    expect(result).toEqual({ status: "success" });
    expect(mocks.createIncome).toHaveBeenCalledWith(USER_ID, {
      description: "September salary",
      amount: 150050,
      currency: "USD",
      date: "2026-09-01",
      categoryId: "cat_1",
      notes: null,
      status: "SETTLED",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("ignores a userId submitted in the form", async () => {
    mocks.createIncome.mockResolvedValue({ id: "inc_1" });

    await createIncomeAction(buildFormData({ userId: "attacker" }));

    expect(mocks.createIncome.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createIncome.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createIncome.mockRejectedValue(new Error("connection refused"));

    const result = await createIncomeAction(buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateIncomeAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await updateIncomeAction("inc_1", buildFormData());

    expect(result.status).toBe("error");
    expect(mocks.updateIncome).not.toHaveBeenCalled();
  });

  it("updates through the service scoped to the user and revalidates", async () => {
    mocks.updateIncome.mockResolvedValue(true);

    const result = await updateIncomeAction("inc_1", buildFormData());

    expect(result).toEqual({ status: "success" });
    expect(mocks.updateIncome).toHaveBeenCalledWith(
      USER_ID,
      "inc_1",
      expect.objectContaining({ amount: 150050 }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a missing record", async () => {
    mocks.updateIncome.mockResolvedValue(false);

    const result = await updateIncomeAction("inc_other", buildFormData());

    expect(result).toEqual({
      status: "error",
      message: "No se encontró el ingreso.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const result = await updateIncomeAction(
      "inc_1",
      buildFormData({ date: "nope" }),
    );

    expect(result.status === "error" && result.fieldErrors).toHaveProperty(
      "date",
    );
    expect(mocks.updateIncome).not.toHaveBeenCalled();
  });
});

describe("setIncomeStatusAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await setIncomeStatusAction("inc_1", "SETTLED");

    expect(result.status).toBe("error");
    expect(mocks.setIncomeStatus).not.toHaveBeenCalled();
  });

  it("changes the status through the service scoped to the user and revalidates", async () => {
    mocks.setIncomeStatus.mockResolvedValue(true);

    const result = await setIncomeStatusAction("inc_1", "PLANNED");

    expect(result).toEqual({ status: "success" });
    expect(mocks.setIncomeStatus).toHaveBeenCalledWith(
      USER_ID,
      "inc_1",
      "PLANNED",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("refuses a status that does not exist without touching the service", async () => {
    const result = await setIncomeStatusAction("inc_1", "DONE" as never);

    expect(result.status).toBe("error");
    expect(mocks.setIncomeStatus).not.toHaveBeenCalled();
  });

  it("reports a missing record", async () => {
    mocks.setIncomeStatus.mockResolvedValue(false);

    const result = await setIncomeStatusAction("inc_other", "SETTLED");

    expect(result).toEqual({
      status: "error",
      message: "No se encontró el ingreso.",
    });
  });
});

describe("deleteIncomeAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await deleteIncomeAction("inc_1");

    expect(result.status).toBe("error");
    expect(mocks.deleteIncome).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user and revalidates", async () => {
    mocks.deleteIncome.mockResolvedValue(true);

    const result = await deleteIncomeAction("inc_1");

    expect(result).toEqual({ status: "success" });
    expect(mocks.deleteIncome).toHaveBeenCalledWith(USER_ID, "inc_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a missing record", async () => {
    mocks.deleteIncome.mockResolvedValue(false);

    const result = await deleteIncomeAction("inc_other");

    expect(result).toEqual({
      status: "error",
      message: "No se encontró el ingreso.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteIncome.mockRejectedValue(new Error("boom"));

    const result = await deleteIncomeAction("inc_1");

    expect(result).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("category ownership errors on income actions", () => {
  it("maps a foreign category on create to a categoryId field error", async () => {
    mocks.createIncome.mockRejectedValue(new CategoryNotFoundError());

    const result = await createIncomeAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("maps a foreign category on update to a categoryId field error", async () => {
    mocks.updateIncome.mockRejectedValue(new CategoryNotFoundError());

    const result = await updateIncomeAction("inc_1", buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
  });
});

describe("createCategoryAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await createCategoryAction("Rent");

    expect(result).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });

  it("returns a name field error for an invalid name", async () => {
    const result = await createCategoryAction("   ");

    expect(result.status === "error" && result.fieldErrors).toHaveProperty(
      "name",
    );
    expect(mocks.createCategory).not.toHaveBeenCalled();
  });

  it("creates the category for the authenticated user and revalidates", async () => {
    mocks.createCategory.mockResolvedValue({ id: "c9", name: "Rent" });

    const result = await createCategoryAction("  Rent  ");

    expect(result).toEqual({
      status: "success",
      category: { id: "c9", name: "Rent" },
    });
    expect(mocks.createCategory).toHaveBeenCalledWith(USER_ID, "Rent");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a duplicate as a friendly name field error", async () => {
    mocks.createCategory.mockRejectedValue(new DuplicateCategoryError());

    const result = await createCategoryAction("Salary");

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tienes una categoría con este nombre."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createCategory.mockRejectedValue(new Error("boom"));

    const result = await createCategoryAction("Rent");

    expect(result).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});
