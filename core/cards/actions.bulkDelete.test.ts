import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  deleteCards: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({ deleteCards: mocks.deleteCards }));

import { deleteCardsAction } from "./actions";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("deleteCardsAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteCardsAction(["card_1"])).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteCards).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user, reports how many and revalidates", async () => {
    mocks.deleteCards.mockResolvedValue({ deleted: 2, skipped: 0 });

    expect(await deleteCardsAction(["card_1", "card_2"])).toEqual({
      status: "success",
      deleted: 2,
      skipped: 0,
    });
    expect(mocks.deleteCards).toHaveBeenCalledWith(USER_ID, [
      "card_1",
      "card_2",
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("reports the cards left out because they still have pending purchases", async () => {
    mocks.deleteCards.mockResolvedValue({ deleted: 1, skipped: 2 });

    expect(await deleteCardsAction(["card_1", "card_2", "card_3"])).toEqual({
      status: "success",
      deleted: 1,
      skipped: 2,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("does not revalidate when every card was left out, since nothing changed", async () => {
    mocks.deleteCards.mockResolvedValue({ deleted: 0, skipped: 2 });

    expect(await deleteCardsAction(["card_1", "card_2"])).toEqual({
      status: "success",
      deleted: 0,
      skipped: 2,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("sends each id once", async () => {
    mocks.deleteCards.mockResolvedValue({ deleted: 1, skipped: 0 });

    await deleteCardsAction(["card_1", "card_1"]);

    expect(mocks.deleteCards).toHaveBeenCalledWith(USER_ID, ["card_1"]);
  });

  it.each([
    ["an empty list", []],
    ["something that is not a list", "card_1"],
    ["a list with an empty id", ["card_1", ""]],
    ["a list of numbers", [1, 2]],
    [
      "more than 200 ids",
      Array.from({ length: 201 }, (_, index) => `card_${index}`),
    ],
  ])("refuses %s without touching the service", async (_label, ids) => {
    const result = await deleteCardsAction(ids as never);

    expect(result.status).toBe("error");
    expect(mocks.deleteCards).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("reports that none were found when no id is one of the user's cards", async () => {
    mocks.deleteCards.mockResolvedValue({ deleted: 0, skipped: 0 });

    expect(await deleteCardsAction(["card_9"])).toEqual({
      status: "error",
      message: "No se encontraron las tarjetas seleccionadas.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteCards.mockRejectedValue(new Error("db down"));

    expect(await deleteCardsAction(["card_1"])).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
