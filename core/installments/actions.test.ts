import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createInstallmentPlan: vi.fn(),
  createIncomeInstallmentPlan: vi.fn(),
  applyIncomeInstallmentCounts: vi.fn(),
  deleteInstallmentPlan: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createInstallmentPlan: mocks.createInstallmentPlan,
}));
vi.mock("./deleteService", () => ({
  deleteInstallmentPlan: mocks.deleteInstallmentPlan,
}));
vi.mock("./incomeService", () => ({
  createIncomeInstallmentPlan: mocks.createIncomeInstallmentPlan,
  applyIncomeInstallmentCounts: mocks.applyIncomeInstallmentCounts,
}));

import {
  CardCurrencyMismatchError,
  CardNotFoundError,
} from "@/core/cards/errors";
import { CategoryNotFoundError } from "@/core/incomes/errors";

import {
  applyIncomeInstallmentCountsAction,
  createInstallmentPlanAction,
  deleteInstallmentPlanAction,
} from "./actions";
import {
  InstallmentOutOfRangeError,
  InstallmentPlanNotFoundError,
  InvalidInstallmentCountError,
} from "./errors";
import type {
  IncomeInstallmentPlanPayload,
  InstallmentPlanPayload,
} from "./types";

const USER_ID = "user_123";

const payload = (
  patch: Partial<Record<keyof InstallmentPlanPayload, unknown>> = {},
): InstallmentPlanPayload =>
  ({
    description: "Heladera",
    categoryId: "cat_1",
    currency: "ARS",
    medium: "DIGITAL",
    notes: "",
    amount: "1200000",
    amountMode: "total",
    totalCuotas: 12,
    firstDate: "2026-10-15",
    cardOwnership: "borrowed",
    ...patch,
  }) as InstallmentPlanPayload;

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
  mocks.createInstallmentPlan.mockResolvedValue({ id: "plan_1" });
});

describe("createInstallmentPlanAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createInstallmentPlanAction(payload())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createInstallmentPlanAction(
      payload({ amount: "abc", totalCuotas: 1 }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual(
      expect.objectContaining({
        amount: expect.any(Array),
        totalCuotas: expect.any(Array),
      }),
    );
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the plan for the authenticated user, with the total in minor units", async () => {
    expect(await createInstallmentPlanAction(payload())).toEqual({
      status: "success",
    });
    expect(mocks.createInstallmentPlan).toHaveBeenCalledWith(USER_ID, {
      description: "Heladera",
      categoryId: "cat_1",
      currency: "ARS",
      medium: "DIGITAL",
      notes: null,
      totalCuotas: 12,
      totalAmount: 120000000,
      firstDate: "2026-10-15",
    });
  });

  it("multiplies the amount of one installment when that is what was typed", async () => {
    await createInstallmentPlanAction(
      payload({ amount: "100000", amountMode: "perInstallment" }),
    );

    expect(mocks.createInstallmentPlan.mock.calls[0][1].totalAmount).toBe(
      120000000,
    );
  });

  it("passes on the card and the day of the purchase, and lets the service work the dates out", async () => {
    await createInstallmentPlanAction(
      payload({
        cardOwnership: "own",
        cardId: "card_1",
        purchaseDate: "2026-10-10",
      }),
    );

    expect(mocks.createInstallmentPlan.mock.calls[0][1]).toMatchObject({
      cardId: "card_1",
      purchaseDate: "2026-10-10",
    });
  });

  it("asks for the day of the purchase when a card is chosen without it", async () => {
    const result = await createInstallmentPlanAction(
      payload({ cardOwnership: "own", cardId: "card_1" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      purchaseDate: expect.any(Array),
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("asks for a card when the purchase is on an own card but none was chosen", async () => {
    const result = await createInstallmentPlanAction(
      payload({ cardOwnership: "own" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: ["Elegí una tarjeta."],
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("asks to choose between an own and a borrowed card when the payload says neither", async () => {
    const withoutOwnership: Record<string, unknown> = { ...payload() };

    delete withoutOwnership.cardOwnership;

    const result = await createInstallmentPlanAction(
      withoutOwnership as unknown as InstallmentPlanPayload,
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardOwnership: ["Elegí si la tarjeta es propia o prestada."],
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("refuses a card id on a borrowed card", async () => {
    const result = await createInstallmentPlanAction(
      payload({ cardId: "card_1", purchaseDate: "2026-10-10" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: [expect.any(String)],
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("hands the service digital money for an own card even if cash was sent", async () => {
    await createInstallmentPlanAction(
      payload({
        cardOwnership: "own",
        cardId: "card_1",
        purchaseDate: "2026-10-10",
        medium: "CASH",
      }),
    );

    expect(mocks.createInstallmentPlan.mock.calls[0][1].medium).toBe("DIGITAL");
  });

  it("keeps the medium of a borrowed card, which is how the lender is repaid", async () => {
    await createInstallmentPlanAction(payload({ medium: "CASH" }));

    expect(mocks.createInstallmentPlan.mock.calls[0][1].medium).toBe("CASH");
  });

  it("maps a card that is not the user's to a cardId field error", async () => {
    mocks.createInstallmentPlan.mockRejectedValue(new CardNotFoundError());

    const result = await createInstallmentPlanAction(
      payload({
        cardOwnership: "own",
        cardId: "card_9",
        purchaseDate: "2026-10-10",
      }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: ["No se encontró la tarjeta."],
    });
  });

  it("maps a card in another currency to a cardId field error", async () => {
    mocks.createInstallmentPlan.mockRejectedValue(
      new CardCurrencyMismatchError(),
    );

    const result = await createInstallmentPlanAction(
      payload({
        cardOwnership: "own",
        cardId: "card_1",
        purchaseDate: "2026-10-10",
      }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      cardId: ["La tarjeta tiene que estar en la misma moneda que la compra."],
    });
  });

  it("maps installments that would fall outside the supported years to a purchaseDate field error", async () => {
    mocks.createInstallmentPlan.mockRejectedValue(
      new InstallmentOutOfRangeError(),
    );

    const result = await createInstallmentPlanAction(
      payload({
        cardOwnership: "own",
        cardId: "card_1",
        purchaseDate: "2026-10-10",
      }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      purchaseDate: ["La última cuota quedaría fuera de los años 2000 a 2099."],
    });
  });

  it("revalidates the expenses page and the summary", async () => {
    await createInstallmentPlanAction(payload());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("ignores a userId in the payload", async () => {
    await createInstallmentPlanAction(payload({ userId: "attacker" } as never));

    expect(mocks.createInstallmentPlan.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createInstallmentPlan.mock.calls[0][1]).not.toHaveProperty(
      "userId",
    );
  });

  it("maps a foreign category to a categoryId field error", async () => {
    mocks.createInstallmentPlan.mockRejectedValue(new CategoryNotFoundError());

    const result = await createInstallmentPlanAction(payload());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createInstallmentPlan.mockRejectedValue(new Error("db down"));

    expect(await createInstallmentPlanAction(payload())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });

  it("refuses something that is not an object", async () => {
    const result = await createInstallmentPlanAction("nope" as never);

    expect(result.status).toBe("error");
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });
});

describe("createInstallmentPlanAction with kind income", () => {
  const repayment = (
    patch: Record<string, unknown> = {},
  ): IncomeInstallmentPlanPayload =>
    ({
      kind: "income",
      description: "Préstamo a Juan",
      categoryId: "cat_1",
      currency: "ARS",
      medium: "CASH",
      notes: "",
      amount: "600000",
      amountMode: "total",
      totalCuotas: 6,
      firstDate: "2026-10-15",
      ...patch,
    }) as IncomeInstallmentPlanPayload;

  beforeEach(() => {
    mocks.createIncomeInstallmentPlan.mockResolvedValue({ id: "plan_1" });
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createInstallmentPlanAction(repayment())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createIncomeInstallmentPlan).not.toHaveBeenCalled();
  });

  it("creates the loan plan for the authenticated user, with the total in minor units, through the income service", async () => {
    expect(await createInstallmentPlanAction(repayment())).toEqual({
      status: "success",
    });
    expect(mocks.createIncomeInstallmentPlan).toHaveBeenCalledWith(USER_ID, {
      description: "Préstamo a Juan",
      categoryId: "cat_1",
      currency: "ARS",
      medium: "CASH",
      notes: null,
      totalCuotas: 6,
      totalAmount: 60000000,
      firstDate: "2026-10-15",
    });
    expect(mocks.createInstallmentPlan).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createInstallmentPlanAction(
      repayment({ amount: "abc", totalCuotas: 1, description: " " }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual(
      expect.objectContaining({
        amount: expect.any(Array),
        totalCuotas: expect.any(Array),
        description: ["El concepto es obligatorio."],
      }),
    );
    expect(mocks.createIncomeInstallmentPlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("never lets a card through", async () => {
    await createInstallmentPlanAction(
      repayment({ cardId: "card_1", purchaseDate: "2026-10-10" }),
    );

    expect(
      mocks.createIncomeInstallmentPlan.mock.calls[0][1],
    ).not.toHaveProperty("cardId");
  });

  it("maps a foreign income category to a categoryId field error", async () => {
    mocks.createIncomeInstallmentPlan.mockRejectedValue(
      new CategoryNotFoundError(),
    );

    const result = await createInstallmentPlanAction(repayment());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      categoryId: ["Selecciona una categoría válida."],
    });
  });

  it("revalidates the incomes page and the summary, not the expenses", async () => {
    await createInstallmentPlanAction(repayment());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
    expect(mocks.revalidatePath).not.toHaveBeenCalledWith(
      "/dashboard/expenses",
    );
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createIncomeInstallmentPlan.mockRejectedValue(new Error("db down"));

    expect(await createInstallmentPlanAction(repayment())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });

  it("keeps treating a payload without a kind as a purchase", async () => {
    await createInstallmentPlanAction(payload());

    expect(mocks.createInstallmentPlan).toHaveBeenCalledTimes(1);
    expect(mocks.createIncomeInstallmentPlan).not.toHaveBeenCalled();
  });
});

describe("applyIncomeInstallmentCountsAction", () => {
  beforeEach(() => {
    mocks.applyIncomeInstallmentCounts.mockResolvedValue(undefined);
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-20T15:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(
      await applyIncomeInstallmentCountsAction([
        { planId: "plan_1", count: 1 },
      ]),
    ).toEqual({ status: "error", message: "Debes iniciar sesión." });
    expect(mocks.applyIncomeInstallmentCounts).not.toHaveBeenCalled();
  });

  it("applies the counts for the authenticated user in the current month (Argentine date), never one the browser says", async () => {
    expect(
      await applyIncomeInstallmentCountsAction([
        { planId: "plan_1", count: 2 },
      ]),
    ).toEqual({ status: "success" });
    expect(mocks.applyIncomeInstallmentCounts).toHaveBeenCalledWith(
      USER_ID,
      "2026-10",
      [{ planId: "plan_1", count: 2 }],
    );
  });

  it("refuses malformed counts without touching the service", async () => {
    const result = await applyIncomeInstallmentCountsAction([
      { planId: "plan_1", count: -1 },
    ]);

    expect(result.status).toBe("error");
    expect(mocks.applyIncomeInstallmentCounts).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("tells which loan cannot take that many installments", async () => {
    mocks.applyIncomeInstallmentCounts.mockRejectedValue(
      new InvalidInstallmentCountError("Préstamo a Juan"),
    );

    expect(
      await applyIncomeInstallmentCountsAction([
        { planId: "plan_1", count: 9 },
      ]),
    ).toEqual({
      status: "error",
      message:
        "«Préstamo a Juan» no tiene tantas cuotas pendientes. Revisá la cantidad.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the incomes page and the summary", async () => {
    await applyIncomeInstallmentCountsAction([{ planId: "plan_1", count: 1 }]);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("returns a generic error when the service fails", async () => {
    mocks.applyIncomeInstallmentCounts.mockRejectedValue(new Error("db down"));

    expect(
      await applyIncomeInstallmentCountsAction([
        { planId: "plan_1", count: 1 },
      ]),
    ).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("deleteInstallmentPlanAction", () => {
  beforeEach(() => {
    mocks.deleteInstallmentPlan.mockResolvedValue(12);
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteInstallmentPlanAction("plan_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteInstallmentPlan).not.toHaveBeenCalled();
  });

  it("rejects a blank or non-text plan id without touching the service", async () => {
    for (const id of ["", "   ", 5 as unknown as string]) {
      expect((await deleteInstallmentPlanAction(id)).status).toBe("error");
    }

    expect(mocks.deleteInstallmentPlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("deletes the plan of the authenticated user and says how many entries went away", async () => {
    expect(await deleteInstallmentPlanAction("plan_1")).toEqual({
      status: "success",
      deleted: 12,
    });
    expect(mocks.deleteInstallmentPlan).toHaveBeenCalledWith(USER_ID, "plan_1");
  });

  it("revalidates the pages that show the entries, the cards and the summary", async () => {
    await deleteInstallmentPlanAction("plan_1");

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("answers with a message when the plan is not found, without revalidating", async () => {
    mocks.deleteInstallmentPlan.mockRejectedValue(
      new InstallmentPlanNotFoundError(),
    );

    expect(await deleteInstallmentPlanAction("plan_x")).toEqual({
      status: "error",
      message:
        "No se encontró el plan de cuotas. Actualizá la página e intentá de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteInstallmentPlan.mockRejectedValue(new Error("db down"));

    expect(await deleteInstallmentPlanAction("plan_1")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
