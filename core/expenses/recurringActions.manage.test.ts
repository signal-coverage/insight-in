import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  updateRecurringExpense: vi.fn(),
  setRecurringDecision: vi.fn(),
  removeRecurringExpense: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./recurringService", () => ({
  applyRecurringDecisions: vi.fn(),
  updateRecurringExpense: mocks.updateRecurringExpense,
  setRecurringDecision: mocks.setRecurringDecision,
  removeRecurringExpense: mocks.removeRecurringExpense,
}));

import { CategoryNotFoundError } from "@/core/incomes/errors";

import { RecurringExpenseSettledError, RecurringNotFoundError } from "./errors";
import {
  removeRecurringExpenseAction,
  setRecurringDecisionAction,
  updateRecurringExpenseAction,
} from "./recurringActions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // 2026-10-15 in Argentina, whatever the machine's zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  mocks.auth.mockResolvedValue({ userId: USER_ID });
  mocks.updateRecurringExpense.mockResolvedValue(true);
  mocks.setRecurringDecision.mockResolvedValue(undefined);
  mocks.removeRecurringExpense.mockResolvedValue(true);
});

afterEach(() => {
  vi.useRealTimers();
});

const formOf = (patch: Record<string, string> = {}): FormData => {
  const formData = new FormData();

  Object.entries({
    description: "Gym",
    amount: "45.00",
    currency: "USD",
    categoryId: "cat_2",
    notes: "",
    medium: "CASH",
    dayOfMonth: "20",
    ...patch,
  }).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

describe("updateRecurringExpenseAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateRecurringExpenseAction("rec_1", formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.updateRecurringExpense).not.toHaveBeenCalled();
  });

  it("updates the template of the authenticated user with the validated values", async () => {
    expect(await updateRecurringExpenseAction("rec_1", formOf())).toEqual({
      status: "success",
    });
    expect(mocks.updateRecurringExpense).toHaveBeenCalledWith(
      USER_ID,
      "rec_1",
      {
        description: "Gym",
        amount: 4500,
        currency: "USD",
        categoryId: "cat_2",
        notes: null,
        medium: "CASH",
        originCurrency: null,
        originAmount: null,
        dayOfMonth: 20,
      },
    );
  });

  it("passes on the reference price the form sends, in minor units", async () => {
    await updateRecurringExpenseAction(
      "rec_1",
      formOf({ originCurrency: "EUR", originAmount: "20" }),
    );

    expect(mocks.updateRecurringExpense.mock.calls[0][2]).toMatchObject({
      originCurrency: "EUR",
      originAmount: 2000,
    });
  });

  it("returns a field error for an incomplete reference price, and writes nothing", async () => {
    const result = await updateRecurringExpenseAction(
      "rec_1",
      formOf({ originAmount: "20" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      originCurrency: ["Elegí la moneda de origen."],
    });
    expect(mocks.updateRecurringExpense).not.toHaveBeenCalled();
  });

  it("revalidates the expenses page and the summary", async () => {
    await updateRecurringExpenseAction("rec_1", formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("returns field errors, and writes nothing, for invalid values", async () => {
    const result = await updateRecurringExpenseAction(
      "rec_1",
      formOf({ amount: "abc", dayOfMonth: "40" }),
    );

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        amount: expect.any(Array),
        dayOfMonth: ["Ingresá un día entre 1 y 31."],
      },
    });
    expect(mocks.updateRecurringExpense).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports a category that is not the user's on the category field", async () => {
    mocks.updateRecurringExpense.mockRejectedValue(new CategoryNotFoundError());

    expect(await updateRecurringExpenseAction("rec_1", formOf())).toMatchObject(
      { status: "error", fieldErrors: { categoryId: expect.any(Array) } },
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says so when the template is not found", async () => {
    mocks.updateRecurringExpense.mockResolvedValue(false);

    expect(await updateRecurringExpenseAction("rec_1", formOf())).toEqual({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.updateRecurringExpense.mockRejectedValue(new Error("db down"));

    expect(await updateRecurringExpenseAction("rec_1", formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("setRecurringDecisionAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await setRecurringDecisionAction("rec_1", "ENABLED")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.setRecurringDecision).not.toHaveBeenCalled();
  });

  it("enables for the authenticated user and the current month", async () => {
    expect(await setRecurringDecisionAction("rec_1", "ENABLED")).toEqual({
      status: "success",
    });
    expect(mocks.setRecurringDecision).toHaveBeenCalledWith(
      USER_ID,
      "rec_1",
      "2026-10",
      "ENABLED",
    );
  });

  it("disables for the authenticated user and the current month", async () => {
    await setRecurringDecisionAction("rec_1", "DISABLED");

    expect(mocks.setRecurringDecision).toHaveBeenCalledWith(
      USER_ID,
      "rec_1",
      "2026-10",
      "DISABLED",
    );
  });

  it("revalidates the expenses page and the summary", async () => {
    await setRecurringDecisionAction("rec_1", "ENABLED");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("refuses anything but the two decisions, or an empty id, without touching the service", async () => {
    const wrongDecision = await setRecurringDecisionAction(
      "rec_1",
      "remove" as never,
    );
    const noId = await setRecurringDecisionAction("  ", "ENABLED");

    expect(wrongDecision.status).toBe("error");
    expect(noId.status).toBe("error");
    expect(mocks.setRecurringDecision).not.toHaveBeenCalled();
  });

  it("explains that a paid expense has to be deleted from the table first", async () => {
    mocks.setRecurringDecision.mockRejectedValue(
      new RecurringExpenseSettledError("Gym", "SETTLED"),
    );

    expect(await setRecurringDecisionAction("rec_1", "DISABLED")).toEqual({
      status: "error",
      message:
        "El gasto de este mes de «Gym» ya está pagado y suma en tu presupuesto. Para sacar ese dinero del presupuesto, eliminalo desde la tabla de Gastos y después deshabilitá el recurrente.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("words it for an expense covered by someone else", async () => {
    mocks.setRecurringDecision.mockRejectedValue(
      new RecurringExpenseSettledError("Gym", "COVERED"),
    );

    expect(await setRecurringDecisionAction("rec_1", "DISABLED")).toEqual({
      status: "error",
      message:
        "El gasto de este mes de «Gym» ya está marcado como cubierto y suma en tu presupuesto. Para sacar ese dinero del presupuesto, eliminalo desde la tabla de Gastos y después deshabilitá el recurrente.",
    });
  });

  it("says so when the template is not found", async () => {
    mocks.setRecurringDecision.mockRejectedValue(new RecurringNotFoundError());

    expect(await setRecurringDecisionAction("rec_1", "ENABLED")).toEqual({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.setRecurringDecision.mockRejectedValue(new Error("db down"));

    expect(await setRecurringDecisionAction("rec_1", "ENABLED")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("removeRecurringExpenseAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await removeRecurringExpenseAction("rec_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.removeRecurringExpense).not.toHaveBeenCalled();
  });

  it("removes the template of the authenticated user and revalidates", async () => {
    expect(await removeRecurringExpenseAction("rec_1")).toEqual({
      status: "success",
    });
    expect(mocks.removeRecurringExpense).toHaveBeenCalledWith(USER_ID, "rec_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("refuses an empty id without touching the service", async () => {
    expect((await removeRecurringExpenseAction("")).status).toBe("error");
    expect(mocks.removeRecurringExpense).not.toHaveBeenCalled();
  });

  it("says so when the template is not found", async () => {
    mocks.removeRecurringExpense.mockResolvedValue(false);

    expect(await removeRecurringExpenseAction("rec_1")).toEqual({
      status: "error",
      message: "No se encontró el gasto recurrente.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
