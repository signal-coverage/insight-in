import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createBank: vi.fn(),
  updateBank: vi.fn(),
  archiveBank: vi.fn(),
  unarchiveBank: vi.fn(),
  deleteBank: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createBank: mocks.createBank,
  updateBank: mocks.updateBank,
  archiveBank: mocks.archiveBank,
  unarchiveBank: mocks.unarchiveBank,
  deleteBank: mocks.deleteBank,
}));

import {
  BankHasAccountsError,
  BankHasActiveAccountsError,
  BankHasCardsError,
  BankHasCryptoAccountsError,
  BankNotFoundError,
  DuplicateBankError,
} from "./errors";
import {
  archiveBankAction,
  createBankAction,
  deleteBankAction,
  unarchiveBankAction,
  updateBankAction,
} from "./actions";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}) => {
  const values: Record<string, string> = {
    name: "Banco Galicia",
    kind: "ENTITY",
    ...patch,
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

describe("createBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createBank).not.toHaveBeenCalled();
  });

  it("returns field errors for a blank name without touching the service", async () => {
    const result = await createBankAction(formOf({ name: "   " }));

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["El nombre es obligatorio."] },
    });
    expect(mocks.createBank).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the bank for the authenticated user with the trimmed name", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    expect(
      await createBankAction(formOf({ name: "  Banco Galicia  " })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.createBank).toHaveBeenCalledWith(USER_ID, {
      name: "Banco Galicia",
      kind: "ENTITY",
    });
  });

  it("ignores a userId in the form", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf({ name: "Galicia", userId: "attacker" }));

    expect(mocks.createBank.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createBank.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("revalidates the banks page after a successful write", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf());

    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("puts a duplicate name on the name field and does not revalidate", async () => {
    mocks.createBank.mockRejectedValue(new DuplicateBankError());

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { name: ["Ya tenés un banco con este nombre."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createBank.mockRejectedValue(new Error("db down"));

    expect(await createBankAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });

  it("logs an unexpected failure under the banks scope", async () => {
    mocks.createBank.mockRejectedValue(new Error("db down"));

    await createBankAction(formOf());

    expect(console.error).toHaveBeenCalledWith(
      "[banks] action failed",
      expect.any(Error),
    );
  });
});

describe("updateBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateBankAction("bank_1", formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateBankAction(
      "bank_1",
      formOf({ name: "a".repeat(41) }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["El nombre admite como máximo 40 caracteres."],
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("renames the bank of the authenticated user and revalidates", async () => {
    mocks.updateBank.mockResolvedValue(undefined);

    expect(
      await updateBankAction("bank_1", formOf({ name: "Galicia" })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.updateBank).toHaveBeenCalledWith(USER_ID, "bank_1", {
      name: "Galicia",
      kind: "ENTITY",
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("answers 'not found' for an id that is not text, without touching the service", async () => {
    expect(await updateBankAction("", formOf())).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.updateBank.mockRejectedValue(new BankNotFoundError());

    expect(await updateBankAction("bank_of_someone_else", formOf())).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.updateBank.mockRejectedValue(new DuplicateBankError());

    const result = await updateBankAction("bank_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["Ya tenés un banco con este nombre."],
    });
  });
});

describe("archiveBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.archiveBank).not.toHaveBeenCalled();
  });

  it("archives the bank of the authenticated user and revalidates", async () => {
    mocks.archiveBank.mockResolvedValue(undefined);

    expect(await archiveBankAction("bank_1")).toEqual({ status: "success" });
    expect(mocks.archiveBank).toHaveBeenCalledWith(USER_ID, "bank_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("explains that the accounts must be archived first, and how many are left", async () => {
    mocks.archiveBank.mockRejectedValue(new BankHasActiveAccountsError(2));

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message:
        "Este banco todavía tiene 2 cuentas activas. Archivalas primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says it in the singular for one account", async () => {
    mocks.archiveBank.mockRejectedValue(new BankHasActiveAccountsError(1));

    expect(await archiveBankAction("bank_1")).toEqual({
      status: "error",
      message: "Este banco todavía tiene 1 cuenta activa. Archivala primero.",
    });
  });

  it("answers 'not found' for another user's bank and for an id that is not text", async () => {
    mocks.archiveBank.mockRejectedValue(new BankNotFoundError());

    expect(await archiveBankAction("bank_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(await archiveBankAction("")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });
});

describe("unarchiveBankAction", () => {
  it("brings the bank of the authenticated user back and revalidates", async () => {
    mocks.unarchiveBank.mockResolvedValue(undefined);

    expect(await unarchiveBankAction("bank_1")).toEqual({ status: "success" });
    expect(mocks.unarchiveBank).toHaveBeenCalledWith(USER_ID, "bank_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await unarchiveBankAction("bank_1");

    expect(mocks.unarchiveBank).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.unarchiveBank.mockRejectedValue(new BankNotFoundError());

    expect(await unarchiveBankAction("bank_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });
});

describe("deleteBankAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteBankAction("bank_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteBank).not.toHaveBeenCalled();
  });

  it("deletes the bank of the authenticated user and revalidates the banks, transfers, overview and cards pages", async () => {
    mocks.deleteBank.mockResolvedValue(undefined);

    expect(await deleteBankAction("bank_1")).toEqual({ status: "success" });
    expect(mocks.deleteBank).toHaveBeenCalledTimes(1);
    expect(mocks.deleteBank).toHaveBeenCalledWith(USER_ID, "bank_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
      "/dashboard/cards",
    ]);
  });

  it("says the accounts must be removed first, and how many are left", async () => {
    mocks.deleteBank.mockRejectedValue(new BankHasAccountsError(2));

    expect(await deleteBankAction("bank_1")).toEqual({
      status: "error",
      message:
        "Este banco todavía tiene 2 cuentas (archivadas incluidas). Eliminalas primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says it in the singular for one account", async () => {
    mocks.deleteBank.mockRejectedValue(new BankHasAccountsError(1));

    expect(await deleteBankAction("bank_1")).toEqual({
      status: "error",
      message:
        "Este banco todavía tiene 1 cuenta (archivadas incluidas). Eliminala primero.",
    });
  });

  it("says the cards must be removed first, in plural and singular", async () => {
    mocks.deleteBank.mockRejectedValueOnce(new BankHasCardsError(3));
    mocks.deleteBank.mockRejectedValueOnce(new BankHasCardsError(1));

    expect(await deleteBankAction("bank_1")).toEqual({
      status: "error",
      message: "Este banco todavía tiene 3 tarjetas. Eliminalas primero.",
    });
    expect(await deleteBankAction("bank_1")).toEqual({
      status: "error",
      message: "Este banco todavía tiene 1 tarjeta. Eliminala primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.deleteBank.mockRejectedValue(new BankNotFoundError());

    expect(await deleteBankAction("bank_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
    expect(mocks.deleteBank).toHaveBeenCalledTimes(1);
  });

  it("answers 'not found' without calling the service for a missing, empty or non-text id", async () => {
    const expected = { status: "error", message: "No se encontró el banco." };

    expect(await deleteBankAction("")).toEqual(expected);
    expect(await deleteBankAction(undefined as unknown as string)).toEqual(
      expected,
    );
    expect(await deleteBankAction(42 as unknown as string)).toEqual(expected);
    expect(mocks.deleteBank).not.toHaveBeenCalled();
  });
});

describe("the kind of a bank", () => {
  it("sends the kind chosen to the service", async () => {
    mocks.createBank.mockResolvedValue({ id: "bank_1" });

    await createBankAction(formOf({ name: "Mercado Pago", kind: "WALLET" }));

    expect(mocks.createBank).toHaveBeenCalledWith(USER_ID, {
      name: "Mercado Pago",
      kind: "WALLET",
    });
  });

  it("refuses a missing kind under Tipo, without touching the service", async () => {
    const formData = formOf();

    formData.delete("kind");

    const result = await updateBankAction("bank_1", formData);

    expect(result.status === "error" && result.fieldErrors).toEqual({
      kind: ["Elegí el tipo de banco."],
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("refuses an unknown kind under Tipo, without touching the service", async () => {
    const result = await updateBankAction("bank_1", formOf({ kind: "CRYPTO" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      kind: ["Elegí el tipo de banco."],
    });
    expect(mocks.updateBank).not.toHaveBeenCalled();
  });

  it("puts the refusal to make a wallet with crypto accounts an entity under Tipo", async () => {
    mocks.updateBank.mockRejectedValue(new BankHasCryptoAccountsError(1));

    const result = await updateBankAction("bank_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      kind: [
        "Este banco tiene cuentas cripto (archivadas incluidas). Eliminalas antes de pasarlo a entidad bancaria.",
      ],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
