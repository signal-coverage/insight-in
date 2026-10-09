import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createTransfer: vi.fn(),
  updateTransfer: vi.fn(),
  deleteTransfer: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createTransfer: mocks.createTransfer,
  updateTransfer: mocks.updateTransfer,
  deleteTransfer: mocks.deleteTransfer,
}));

import { formatMoney } from "@/core/incomes/money";

import {
  createTransferAction,
  deleteTransferAction,
  updateTransferAction,
} from "./actions";
import { giveBackMessage, insufficientFundsMessage } from "./consts";
import {
  TransferAccountError,
  TransferFutureDateError,
  TransferGiveBackError,
  TransferInsufficientFundsError,
  TransferSameAccountError,
} from "./errors";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    currency: "ARS",
    fromAccountId: "acc_a",
    toAccountId: "acc_b",
    amount: "1500.50",
    date: "2026-10-06",
    notes: "Alquiler",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

const STORED = {
  currency: "ARS",
  fromAccountId: "acc_a",
  toAccountId: "acc_b",
  amount: 150050,
  date: "2026-10-06",
  notes: "Alquiler",
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createTransferAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createTransferAction(
      formOf({ amount: "abc", toAccountId: "acc_a" }),
    );

    expect(result).toMatchObject({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
        toAccountId: [
          "El origen y el destino tienen que ser cuentas distintas.",
        ],
      },
    });
    expect(mocks.createTransfer).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the transfer for the authenticated user, with the amount in minor units, and refreshes the three pages", async () => {
    mocks.createTransfer.mockResolvedValue(undefined);

    expect(await createTransferAction(formOf())).toEqual({ status: "success" });
    expect(mocks.createTransfer).toHaveBeenCalledWith(USER_ID, STORED);
    expect(mocks.revalidatePath.mock.calls.map((call) => call[0])).toEqual([
      "/dashboard/transfers",
      "/dashboard/banks",
      "/dashboard/overview",
    ]);
  });

  it("ignores a userId in the form", async () => {
    const formData = formOf();

    formData.set("userId", "attacker");
    mocks.createTransfer.mockResolvedValue(undefined);

    await createTransferAction(formData);

    expect(mocks.createTransfer).toHaveBeenCalledWith(USER_ID, STORED);
  });

  it.each([
    [
      "an unusable source account",
      new TransferAccountError("from", "ARCHIVED"),
      "fromAccountId",
      "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
    ],
    [
      "a destination that is not the user's",
      new TransferAccountError("to", "NOT_FOUND"),
      "toAccountId",
      "Elegí una cuenta válida.",
    ],
    [
      "a destination in another currency",
      new TransferAccountError("to", "CURRENCY_MISMATCH"),
      "toAccountId",
      "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.",
    ],
    [
      "the same account on both sides",
      new TransferSameAccountError(),
      "toAccountId",
      "El origen y el destino tienen que ser cuentas distintas.",
    ],
    [
      "a future date",
      new TransferFutureDateError(),
      "date",
      "La fecha no puede ser posterior a hoy.",
    ],
  ])(
    "turns %s into an error on its field",
    async (_label, error, field, message) => {
      mocks.createTransfer.mockRejectedValue(error);

      expect(await createTransferAction(formOf())).toEqual({
        status: "error",
        message: "Corrige los campos resaltados.",
        fieldErrors: { [field]: [message] },
      });
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("says how much the source held when it has not enough, on the amount", async () => {
    mocks.createTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(120000, "ARS"),
    );

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [insufficientFundsMessage(formatMoney(120000, "ARS"))],
      },
    });
  });

  it("logs an unexpected failure and answers a generic message", async () => {
    mocks.createTransfer.mockRejectedValue(new Error("db down"));

    expect(await createTransferAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("updateTransferAction", () => {
  it("updates the transfer of the user with the validated input", async () => {
    mocks.updateTransfer.mockResolvedValue(true);

    expect(await updateTransferAction("tr_1", formOf())).toEqual({
      status: "success",
    });
    expect(mocks.updateTransfer).toHaveBeenCalledWith(USER_ID, "tr_1", STORED);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it.each([
    ["a missing id", undefined],
    ["an empty id", ""],
    ["a number", 42],
    ["an object", { id: "tr_1" }],
  ])(
    "says not found for %s without touching the service or refreshing anything",
    async (_label, id) => {
      expect(
        await updateTransferAction(id as unknown as string, formOf()),
      ).toEqual({
        status: "error",
        message: "No se encontró la transferencia.",
      });
      expect(mocks.updateTransfer).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("still updates through the service with a valid id", async () => {
    mocks.updateTransfer.mockResolvedValue(true);

    expect(await updateTransferAction("tr_9", formOf())).toEqual({
      status: "success",
    });
    expect(mocks.updateTransfer).toHaveBeenCalledWith(USER_ID, "tr_9", STORED);
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("says the transfer was not found when it is not the user's, and refreshes nothing", async () => {
    mocks.updateTransfer.mockResolvedValue(false);

    expect(await updateTransferAction("tr_x", formOf())).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateTransferAction("tr_1", formOf({ date: "nope" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      date: ["Ingresa una fecha válida."],
    });
    expect(mocks.updateTransfer).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("shows a refusal to take money back from the old destination on the amount, naming the account and what it holds", async () => {
    mocks.updateTransfer.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 800, 1000, "ARS"),
    );

    expect(await updateTransferAction("tr_1", formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        amount: [
          giveBackMessage(
            "Efectivo · Efectivo",
            formatMoney(800, "ARS"),
            formatMoney(1000, "ARS"),
          ),
        ],
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("rethrows an unexpected failure (logged, generic answer, never a known one) and refreshes nothing", async () => {
    mocks.updateTransfer.mockRejectedValue(new Error("db down"));

    expect(await updateTransferAction("tr_1", formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(console.error).toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("turns a domain error into the field it is about", async () => {
    mocks.updateTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(0, "ARS"),
    );

    const result = await updateTransferAction("tr_1", formOf());

    expect(
      result.status === "error" && Object.keys(result.fieldErrors ?? {}),
    ).toEqual(["amount"]);
  });
});

describe("deleteTransferAction", () => {
  it("rejects unauthenticated callers", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteTransferAction("tr_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteTransfer).not.toHaveBeenCalled();
  });

  it("deletes through the service scoped to the user and refreshes the three pages", async () => {
    mocks.deleteTransfer.mockResolvedValue(true);

    expect(await deleteTransferAction("tr_1")).toEqual({ status: "success" });
    expect(mocks.deleteTransfer).toHaveBeenCalledWith(USER_ID, "tr_1");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(3);
  });

  it("answers a plain message, naming the account and what it holds, when the destination already spent the money; it refreshes nothing and logs nothing", async () => {
    mocks.deleteTransfer.mockRejectedValue(
      new TransferGiveBackError("Efectivo · Efectivo", 300, 1500, "ARS"),
    );

    expect(await deleteTransferAction("tr_1")).toEqual({
      status: "error",
      message: giveBackMessage(
        "Efectivo · Efectivo",
        formatMoney(300, "ARS"),
        formatMoney(1500, "ARS"),
      ),
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });

  it("says not found for another user's id or for an id that is not text", async () => {
    mocks.deleteTransfer.mockResolvedValue(false);

    expect(await deleteTransferAction("tr_x")).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(await deleteTransferAction("" as string)).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(await deleteTransferAction(undefined as unknown as string)).toEqual({
      status: "error",
      message: "No se encontró la transferencia.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("rethrows an unexpected failure (logged, generic answer) and refreshes nothing", async () => {
    mocks.deleteTransfer.mockRejectedValue(new Error("db down"));

    expect(await deleteTransferAction("tr_1")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(console.error).toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("a transfer in a crypto currency", () => {
  it("hands the service the amount in millionths", async () => {
    mocks.createTransfer.mockResolvedValue(undefined);

    await createTransferAction(formOf({ currency: "USDC", amount: "1.5" }));

    expect(mocks.createTransfer.mock.calls[0][1]).toMatchObject({
      currency: "USDC",
      amount: 1500000,
    });
  });

  it("says what the source held in its own currency", async () => {
    mocks.createTransfer.mockRejectedValue(
      new TransferInsufficientFundsError(1500000, "USDC"),
    );

    expect(
      await createTransferAction(formOf({ currency: "USDC", amount: "2" })),
    ).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { amount: [insufficientFundsMessage("1,50 USDC")] },
    });
  });
});
