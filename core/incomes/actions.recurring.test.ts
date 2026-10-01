import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createRecurringIncome: vi.fn(),
  updateRecurringIncome: vi.fn(),
  deleteRecurringIncome: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createIncome: vi.fn(),
  updateIncome: vi.fn(),
  deleteIncome: vi.fn(),
  createCategory: vi.fn(),
  renameCategory: vi.fn(),
  deleteCategory: vi.fn(),
  createRecurringIncome: mocks.createRecurringIncome,
  updateRecurringIncome: mocks.updateRecurringIncome,
  deleteRecurringIncome: mocks.deleteRecurringIncome,
}));

import {
  createRecurringIncomeAction,
  deleteRecurringIncomeAction,
  updateRecurringIncomeAction,
} from "./actions";
import { CategoryNotFoundError } from "./errors";

const USER_ID = "user_123";

const buildFormData = (overrides: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    description: "Monthly salary",
    amount: "2500.00",
    currency: "USD",
    categoryId: "cat_1",
    notes: "",
    frequency: "MONTHLY",
    startDate: "2026-01-05",
    endDate: "",
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

describe("createRecurringIncomeAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createRecurringIncomeAction(buildFormData())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createRecurringIncome).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const result = await createRecurringIncomeAction(
      buildFormData({ frequency: "DAILY", startDate: "nope" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual(
      expect.objectContaining({
        startDate: expect.any(Array),
        frequency: expect.any(Array),
      }),
    );
    expect(mocks.createRecurringIncome).not.toHaveBeenCalled();
  });

  it("creates the template for the authenticated user and revalidates", async () => {
    mocks.createRecurringIncome.mockResolvedValue({ id: "rec_1" });

    expect(await createRecurringIncomeAction(buildFormData())).toEqual({
      status: "success",
    });
    expect(mocks.createRecurringIncome).toHaveBeenCalledWith(USER_ID, {
      description: "Monthly salary",
      amount: 250000,
      currency: "USD",
      categoryId: "cat_1",
      notes: null,
      frequency: "MONTHLY",
      startDate: "2026-01-05",
      endDate: null,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("ignores a userId submitted in the form", async () => {
    mocks.createRecurringIncome.mockResolvedValue({ id: "rec_1" });

    await createRecurringIncomeAction(buildFormData({ userId: "attacker" }));

    expect(mocks.createRecurringIncome.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createRecurringIncome.mock.calls[0][1]).not.toHaveProperty(
      "userId",
    );
  });

  it("maps a foreign category to a categoryId field error", async () => {
    mocks.createRecurringIncome.mockRejectedValue(new CategoryNotFoundError());

    const result = await createRecurringIncomeAction(buildFormData());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createRecurringIncome.mockRejectedValue(new Error("boom"));

    expect(await createRecurringIncomeAction(buildFormData())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateRecurringIncomeAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    const result = await updateRecurringIncomeAction("rec_1", buildFormData());

    expect(result.status).toBe("error");
    expect(mocks.updateRecurringIncome).not.toHaveBeenCalled();
  });

  it("updates the template scoped to the user and revalidates", async () => {
    mocks.updateRecurringIncome.mockResolvedValue(true);

    expect(await updateRecurringIncomeAction("rec_1", buildFormData())).toEqual(
      {
        status: "success",
      },
    );
    expect(mocks.updateRecurringIncome).toHaveBeenCalledWith(
      USER_ID,
      "rec_1",
      expect.objectContaining({ amount: 250000, frequency: "MONTHLY" }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a missing template", async () => {
    mocks.updateRecurringIncome.mockResolvedValue(false);

    expect(await updateRecurringIncomeAction("rec_x", buildFormData())).toEqual(
      {
        status: "error",
        message: "No se encontró el ingreso recurrente.",
      },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input", async () => {
    const result = await updateRecurringIncomeAction(
      "rec_1",
      buildFormData({ startDate: "nope" }),
    );

    expect(result.status === "error" && result.fieldErrors).toHaveProperty(
      "startDate",
    );
    expect(mocks.updateRecurringIncome).not.toHaveBeenCalled();
  });

  it("rejects an empty id", async () => {
    const result = await updateRecurringIncomeAction("  ", buildFormData());

    expect(result.status).toBe("error");
    expect(mocks.updateRecurringIncome).not.toHaveBeenCalled();
  });
});

describe("deleteRecurringIncomeAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect((await deleteRecurringIncomeAction("rec_1")).status).toBe("error");
    expect(mocks.deleteRecurringIncome).not.toHaveBeenCalled();
  });

  it("deletes the template scoped to the user and revalidates", async () => {
    mocks.deleteRecurringIncome.mockResolvedValue(true);

    expect(await deleteRecurringIncomeAction("rec_1")).toEqual({
      status: "success",
    });
    expect(mocks.deleteRecurringIncome).toHaveBeenCalledWith(USER_ID, "rec_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("reports a missing template", async () => {
    mocks.deleteRecurringIncome.mockResolvedValue(false);

    expect(await deleteRecurringIncomeAction("rec_x")).toEqual({
      status: "error",
      message: "No se encontró el ingreso recurrente.",
    });
  });

  it("rejects an empty id", async () => {
    expect((await deleteRecurringIncomeAction("")).status).toBe("error");
    expect(mocks.deleteRecurringIncome).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteRecurringIncome.mockRejectedValue(new Error("boom"));

    expect(await deleteRecurringIncomeAction("rec_1")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});
