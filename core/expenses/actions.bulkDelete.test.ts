import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  deleteExpenses: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({ deleteExpenses: mocks.deleteExpenses }));

import { deleteExpensesAction } from "./actions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("deleteExpensesAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteExpensesAction(["exp_1"])).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteExpenses).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user, reports how many and revalidates", async () => {
    mocks.deleteExpenses.mockResolvedValue(2);

    expect(await deleteExpensesAction(["exp_1", "exp_2"])).toEqual({
      status: "success",
      deleted: 2,
    });
    expect(mocks.deleteExpenses).toHaveBeenCalledWith(USER_ID, [
      "exp_1",
      "exp_2",
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/expenses");
  });

  it("sends each id once", async () => {
    mocks.deleteExpenses.mockResolvedValue(1);

    await deleteExpensesAction(["exp_1", "exp_1"]);

    expect(mocks.deleteExpenses).toHaveBeenCalledWith(USER_ID, ["exp_1"]);
  });

  it.each([
    ["an empty list", []],
    ["nothing at all", undefined],
    ["something that is not a list", "exp_1"],
    ["a list with an empty id", ["exp_1", ""]],
    ["a list of numbers", [1, 2]],
    [
      "more than 200 ids",
      Array.from({ length: 201 }, (_, index) => `exp_${index}`),
    ],
  ])("refuses %s without touching the service", async (_label, ids) => {
    const result = await deleteExpensesAction(ids as never);

    expect(result.status).toBe("error");
    expect(mocks.deleteExpenses).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts exactly 200 ids", async () => {
    mocks.deleteExpenses.mockResolvedValue(200);

    const ids = Array.from({ length: 200 }, (_, index) => `exp_${index}`);

    expect(await deleteExpensesAction(ids)).toEqual({
      status: "success",
      deleted: 200,
    });
  });

  it("reports that none were found, without revalidating", async () => {
    mocks.deleteExpenses.mockResolvedValue(0);

    expect(await deleteExpensesAction(["exp_9"])).toEqual({
      status: "error",
      message: "No se encontraron los gastos seleccionados.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteExpenses.mockRejectedValue(new Error("connection refused"));

    expect(await deleteExpensesAction(["exp_1"])).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
