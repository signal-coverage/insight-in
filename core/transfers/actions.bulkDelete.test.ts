import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  deleteTransfers: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({ deleteTransfers: mocks.deleteTransfers }));

import { BULK_INVALID_MESSAGE, MAX_BULK_DELETE } from "@/core/entries/bulk";
import { formatMoney } from "@/core/incomes/money";

import { deleteTransfersAction } from "./actions";
import { giveBackMessage } from "./consts";
import { TransferGiveBackError } from "./errors";

const USER_ID = "user_123";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("deleteTransfersAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteTransfersAction(["tr_1"])).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteTransfers).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user, reports how many and refreshes the three pages", async () => {
    mocks.deleteTransfers.mockResolvedValue(2);

    expect(await deleteTransfersAction(["tr_1", "tr_2", "tr_foreign"])).toEqual(
      {
        status: "success",
        deleted: 2,
      },
    );
    expect(mocks.deleteTransfers).toHaveBeenCalledWith(USER_ID, [
      "tr_1",
      "tr_2",
      "tr_foreign",
    ]);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("deduplicates the ids it sends to the service", async () => {
    mocks.deleteTransfers.mockResolvedValue(1);

    await deleteTransfersAction(["tr_1", "tr_1"]);

    expect(mocks.deleteTransfers).toHaveBeenCalledWith(USER_ID, ["tr_1"]);
  });

  it("answers the refusal as a plain message, naming the account, when one cannot give its money back; nothing is refreshed and nothing is logged", async () => {
    mocks.deleteTransfers.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 1999, 2000, "ARS"),
    );

    expect(await deleteTransfersAction(["tr_1", "tr_2"])).toEqual({
      status: "error",
      message: giveBackMessage(
        "Efectivo · Efectivo",
        formatMoney(1999, "ARS"),
        formatMoney(2000, "ARS"),
      ),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("answers not found when none of the ids is the user's, and refreshes nothing", async () => {
    mocks.deleteTransfers.mockResolvedValue(0);

    expect(await deleteTransfersAction(["tr_x"])).toEqual({
      status: "error",
      message: "No se encontraron las transferencias seleccionadas.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["no ids", []],
    [
      "more ids than a person could select",
      Array.from({ length: MAX_BULK_DELETE + 1 }, (_, i) => `tr_${i}`),
    ],
    ["ids that are not text", [42, null]],
  ])("refuses %s without touching the service", async (_label, ids) => {
    const result = await deleteTransfersAction(ids as never);

    expect(result).toEqual({ status: "error", message: BULK_INVALID_MESSAGE });
    expect(mocks.deleteTransfers).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows an unexpected failure (logged, generic answer) and refreshes nothing", async () => {
    mocks.deleteTransfers.mockRejectedValue(new Error("db down"));

    expect(await deleteTransfersAction(["tr_1"])).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(console.error).toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
