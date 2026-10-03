import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  applyRecurringDecisions: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./recurringService", () => ({
  applyRecurringDecisions: mocks.applyRecurringDecisions,
}));

import { InvalidInstallmentCountError } from "@/core/installments/errors";

import { InvalidRecurringAmountError } from "./errors";
import { applyRecurringDecisionsAction } from "./recurringActions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // 2026-10-15 in Argentina, whatever the machine's zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  mocks.auth.mockResolvedValue({ userId: USER_ID });
  mocks.applyRecurringDecisions.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("applyRecurringDecisionsAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(
      await applyRecurringDecisionsAction([
        { recurringExpenseId: "rec_1", choice: "enable" },
      ]),
    ).toEqual({ status: "error", message: "Debes iniciar sesión." });
    expect(mocks.applyRecurringDecisions).not.toHaveBeenCalled();
  });

  it("applies the choices for the authenticated user and the current month", async () => {
    expect(
      await applyRecurringDecisionsAction([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "100.5" },
        { recurringExpenseId: "rec_2", choice: "remove" },
      ]),
    ).toEqual({ status: "success" });
    expect(mocks.applyRecurringDecisions).toHaveBeenCalledWith(
      USER_ID,
      "2026-10",
      [
        { recurringExpenseId: "rec_1", choice: "enable", amount: "100.5" },
        { recurringExpenseId: "rec_2", choice: "remove" },
      ],
      [],
    );
  });

  it("applies the installment counts together with the choices, in the same call", async () => {
    expect(
      await applyRecurringDecisionsAction(
        [{ recurringExpenseId: "rec_1", choice: "disable" }],
        [
          { planId: "plan_1", count: 2 },
          { planId: "plan_2", count: 0 },
        ],
      ),
    ).toEqual({ status: "success" });
    expect(mocks.applyRecurringDecisions).toHaveBeenCalledTimes(1);
    expect(mocks.applyRecurringDecisions).toHaveBeenCalledWith(
      USER_ID,
      "2026-10",
      [{ recurringExpenseId: "rec_1", choice: "disable" }],
      [
        { planId: "plan_1", count: 2 },
        { planId: "plan_2", count: 0 },
      ],
    );
  });

  it("applies installment counts alone", async () => {
    expect(
      await applyRecurringDecisionsAction([], [{ planId: "plan_1", count: 3 }]),
    ).toEqual({ status: "success" });
    expect(mocks.applyRecurringDecisions.mock.calls[0][3]).toEqual([
      { planId: "plan_1", count: 3 },
    ]);
  });

  it("refuses malformed installment counts without touching the service", async () => {
    const result = await applyRecurringDecisionsAction(
      [],
      [{ planId: "plan_1", count: -1 }],
    );

    expect(result.status).toBe("error");
    expect(mocks.applyRecurringDecisions).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("names the purchase whose count is not valid", async () => {
    mocks.applyRecurringDecisions.mockRejectedValue(
      new InvalidInstallmentCountError("Heladera"),
    );

    expect(
      await applyRecurringDecisionsAction([], [{ planId: "plan_1", count: 9 }]),
    ).toEqual({
      status: "error",
      message:
        "«Heladera» no tiene tantas cuotas pendientes. Revisá la cantidad.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("revalidates the expenses page and the summary", async () => {
    await applyRecurringDecisionsAction([
      { recurringExpenseId: "rec_1", choice: "disable" },
    ]);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("passes on the amount of a disabled row, which sticks to its template", async () => {
    await applyRecurringDecisionsAction([
      { recurringExpenseId: "rec_1", choice: "disable", amount: "5" },
    ]);

    expect(mocks.applyRecurringDecisions.mock.calls[0][2]).toEqual([
      { recurringExpenseId: "rec_1", choice: "disable", amount: "5" },
    ]);
    expect(mocks.applyRecurringDecisions.mock.calls[0][3]).toEqual([]);
  });

  it("drops an amount sent with a removed row", async () => {
    await applyRecurringDecisionsAction([
      { recurringExpenseId: "rec_1", choice: "remove", amount: "5" },
    ]);

    expect(mocks.applyRecurringDecisions.mock.calls[0][2]).toEqual([
      { recurringExpenseId: "rec_1", choice: "remove" },
    ]);
  });

  it("names the expense when the amount of a disabled row is not valid", async () => {
    mocks.applyRecurringDecisions.mockRejectedValue(
      new InvalidRecurringAmountError("Gym"),
    );

    expect(
      await applyRecurringDecisionsAction([
        { recurringExpenseId: "rec_2", choice: "disable", amount: "abc" },
      ]),
    ).toEqual({
      status: "error",
      message: "Ingresá un monto válido para «Gym».",
    });
  });

  it("refuses malformed input without touching the service", async () => {
    const result = await applyRecurringDecisionsAction([
      { recurringExpenseId: "rec_1", choice: "explode" } as never,
    ]);

    expect(result.status).toBe("error");
    expect(mocks.applyRecurringDecisions).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses something that is not a list", async () => {
    const result = await applyRecurringDecisionsAction("nope" as never);

    expect(result.status).toBe("error");
    expect(mocks.applyRecurringDecisions).not.toHaveBeenCalled();
  });

  it("names the expense whose amount is not valid", async () => {
    mocks.applyRecurringDecisions.mockRejectedValue(
      new InvalidRecurringAmountError("Rent"),
    );

    expect(
      await applyRecurringDecisionsAction([
        { recurringExpenseId: "rec_1", choice: "enable", amount: "abc" },
      ]),
    ).toEqual({
      status: "error",
      message: "Ingresá un monto válido para «Rent».",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.applyRecurringDecisions.mockRejectedValue(new Error("db down"));

    expect(
      await applyRecurringDecisionsAction([
        { recurringExpenseId: "rec_1", choice: "enable" },
      ]),
    ).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });

  it("succeeds without error for an empty list", async () => {
    expect(await applyRecurringDecisionsAction([])).toEqual({
      status: "success",
    });
  });
});
