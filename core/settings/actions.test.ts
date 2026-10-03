import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  saveIncludeExpectedIncomes: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  saveIncludeExpectedIncomes: mocks.saveIncludeExpectedIncomes,
}));

import { saveIncludeExpectedIncomesAction } from "./actions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
  mocks.saveIncludeExpectedIncomes.mockResolvedValue(undefined);
});

describe("saveIncludeExpectedIncomesAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await saveIncludeExpectedIncomesAction(false)).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.saveIncludeExpectedIncomes).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([true, false])("saves %s for the signed-in user", async (value) => {
    expect(await saveIncludeExpectedIncomesAction(value)).toEqual({
      status: "success",
    });
    expect(mocks.saveIncludeExpectedIncomes).toHaveBeenCalledWith(
      USER_ID,
      value,
    );
  });

  it("refreshes the summary, where the target remainder shows", async () => {
    await saveIncludeExpectedIncomesAction(false);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("refreshes the settings page too, so its switch keeps the saved value", async () => {
    await saveIncludeExpectedIncomesAction(false);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/settings");
  });

  it.each(["false", 0, null, undefined, { value: true }])(
    "refuses %s, which is not a boolean, and saves nothing",
    async (value) => {
      const result = await saveIncludeExpectedIncomesAction(value);

      expect(result).toEqual({
        status: "error",
        message: "No se pudo guardar la preferencia.",
      });
      expect(mocks.saveIncludeExpectedIncomes).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("answers with a generic message when saving fails, without refreshing", async () => {
    mocks.saveIncludeExpectedIncomes.mockRejectedValue(
      new Error("database down"),
    );

    expect(await saveIncludeExpectedIncomesAction(true)).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
