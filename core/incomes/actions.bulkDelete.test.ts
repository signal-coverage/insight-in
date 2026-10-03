import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  deleteIncomes: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({ deleteIncomes: mocks.deleteIncomes }));

import { deleteIncomesAction } from "./actions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("deleteIncomesAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteIncomesAction(["inc_1"])).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteIncomes).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user, reports how many and revalidates", async () => {
    mocks.deleteIncomes.mockResolvedValue(2);

    expect(await deleteIncomesAction(["inc_1", "inc_2"])).toEqual({
      status: "success",
      deleted: 2,
    });
    expect(mocks.deleteIncomes).toHaveBeenCalledWith(USER_ID, [
      "inc_1",
      "inc_2",
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/incomes");
  });

  it("sends each id once", async () => {
    mocks.deleteIncomes.mockResolvedValue(1);

    await deleteIncomesAction(["inc_1", "inc_1"]);

    expect(mocks.deleteIncomes).toHaveBeenCalledWith(USER_ID, ["inc_1"]);
  });

  it.each([
    ["an empty list", []],
    ["something that is not a list", "inc_1"],
    ["a list with an empty id", ["inc_1", ""]],
    ["a list of numbers", [1, 2]],
    [
      "more than 200 ids",
      Array.from({ length: 201 }, (_, index) => `inc_${index}`),
    ],
  ])("refuses %s without touching the service", async (_label, ids) => {
    const result = await deleteIncomesAction(ids as never);

    expect(result.status).toBe("error");
    expect(mocks.deleteIncomes).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("accepts exactly 200 ids", async () => {
    mocks.deleteIncomes.mockResolvedValue(200);

    const ids = Array.from({ length: 200 }, (_, index) => `inc_${index}`);

    expect(await deleteIncomesAction(ids)).toEqual({
      status: "success",
      deleted: 200,
    });
  });

  it("reports that none were found, without revalidating", async () => {
    mocks.deleteIncomes.mockResolvedValue(0);

    expect(await deleteIncomesAction(["inc_9"])).toEqual({
      status: "error",
      message: "No se encontraron los ingresos seleccionados.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteIncomes.mockRejectedValue(new Error("connection refused"));

    expect(await deleteIncomesAction(["inc_1"])).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
