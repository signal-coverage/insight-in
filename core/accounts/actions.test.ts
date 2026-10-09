import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createAccount: vi.fn(),
  updateAccount: vi.fn(),
  archiveAccount: vi.fn(),
  unarchiveAccount: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createAccount: mocks.createAccount,
  updateAccount: mocks.updateAccount,
  archiveAccount: mocks.archiveAccount,
  unarchiveAccount: mocks.unarchiveAccount,
  deleteAccount: mocks.deleteAccount,
}));

import { BankArchivedError, BankNotFoundError } from "@/core/banks/errors";

import {
  archiveAccountAction,
  createAccountAction,
  deleteAccountAction,
  unarchiveAccountAction,
  updateAccountAction,
} from "./actions";
import {
  AccountCurrencyLockedError,
  AccountHasBalanceError,
  AccountHasMovementsError,
  AccountInUseError,
  AccountNotFoundError,
  CryptoCurrencyNotAllowedError,
  DuplicateAccountError,
} from "./errors";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    bankId: "bank_1",
    name: "Caja de ahorro",
    currency: "ARS",
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

describe("createAccountAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createAccount).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createAccountAction(
      formOf({ bankId: "", name: "  ", currency: "ars" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        bankId: ["Elegí un banco."],
        name: ["El nombre es obligatorio."],
        currency: ["Selecciona una moneda compatible."],
      },
    });
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the account for the authenticated user", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    expect(
      await createAccountAction(formOf({ name: "  Caja de ahorro  " })),
    ).toEqual({
      status: "success",
    });
    expect(mocks.createAccount).toHaveBeenCalledWith(USER_ID, {
      bankId: "bank_1",
      name: "Caja de ahorro",
      currency: "ARS",
    });
  });

  it("ignores a userId and an archive date in the form", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    await createAccountAction(
      formOf({ userId: "attacker", archivedAt: "2026-01-01" }),
    );

    expect(mocks.createAccount.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createAccount.mock.calls[0][1]).not.toHaveProperty("userId");
    expect(mocks.createAccount.mock.calls[0][1]).not.toHaveProperty(
      "archivedAt",
    );
  });

  it("revalidates the banks page after a successful write", async () => {
    mocks.createAccount.mockResolvedValue({ id: "acc_1" });

    await createAccountAction(formOf());

    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.createAccount.mockRejectedValue(new DuplicateAccountError());

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        name: ["Ya tenés una cuenta con este nombre en este banco."],
      },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's bank", async () => {
    mocks.createAccount.mockRejectedValue(new BankNotFoundError());

    expect(
      await createAccountAction(formOf({ bankId: "bank_of_someone_else" })),
    ).toEqual({
      status: "error",
      message: "No se encontró el banco.",
    });
  });

  it("explains that an archived bank cannot take accounts", async () => {
    mocks.createAccount.mockRejectedValue(new BankArchivedError());

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createAccount.mockRejectedValue(new Error("db down"));

    expect(await createAccountAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });

  it("logs an unexpected failure under the accounts scope", async () => {
    mocks.createAccount.mockRejectedValue(new Error("db down"));

    await createAccountAction(formOf());

    expect(console.error).toHaveBeenCalledWith(
      "[accounts] action failed",
      expect.any(Error),
    );
  });
});

describe("updateAccountAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await updateAccountAction("acc_1", formOf());

    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateAccountAction(
      "acc_1",
      formOf({ currency: "ZZZ" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: ["Selecciona una moneda compatible."],
    });
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("saves the name and the currency of the user's account, and never a bank", async () => {
    mocks.updateAccount.mockResolvedValue(undefined);

    expect(
      await updateAccountAction(
        "acc_1",
        formOf({ bankId: "bank_of_someone_else", currency: "USD" }),
      ),
    ).toEqual({ status: "success" });
    expect(mocks.updateAccount).toHaveBeenCalledWith(USER_ID, "acc_1", {
      name: "Caja de ahorro",
      currency: "USD",
    });
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("answers 'not found' for an id that is not text, without touching the service", async () => {
    expect(await updateAccountAction("", formOf())).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    expect(mocks.updateAccount).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account", async () => {
    mocks.updateAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await updateAccountAction("acc_of_someone_else", formOf())).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });

  it("puts a duplicate name on the name field", async () => {
    mocks.updateAccount.mockRejectedValue(new DuplicateAccountError());

    const result = await updateAccountAction("acc_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      name: ["Ya tenés una cuenta con este nombre en este banco."],
    });
  });

  it("puts a locked currency on the currency field", async () => {
    mocks.updateAccount.mockRejectedValue(new AccountCurrencyLockedError());

    const result = await updateAccountAction(
      "acc_1",
      formOf({ currency: "USD" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [
        "La moneda no se puede cambiar: esta cuenta ya tiene movimientos.",
      ],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});

describe("archiveAccountAction", () => {
  it("archives the account of the authenticated user and revalidates", async () => {
    mocks.archiveAccount.mockResolvedValue(undefined);

    expect(await archiveAccountAction("acc_1")).toEqual({ status: "success" });
    expect(mocks.archiveAccount).toHaveBeenCalledWith(USER_ID, "acc_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await archiveAccountAction("acc_1");

    expect(mocks.archiveAccount).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account and for an id that is not text", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await archiveAccountAction("acc_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    expect(await archiveAccountAction("")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });
});

describe("archiveAccountAction and the archive rules", () => {
  it("says how much the account still holds, in its currency", async () => {
    mocks.archiveAccount.mockRejectedValue(
      new AccountHasBalanceError(150000, "ARS"),
    );

    const result = await archiveAccountAction("acc_1");

    expect(result.status).toBe("error");
    expect(result.status === "error" && result.message).toMatch(
      /^Esta cuenta tiene un saldo de \$\s1\.500,00\. Dejala en cero antes de archivarla\.$/,
    );
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says what is still pending on it", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountInUseError(3, 1));

    expect(await archiveAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta todavía tiene 3 movimientos pendientes y 1 recurrente. Pasalos a otra cuenta o eliminalos antes de archivarla.",
    });
  });

  it("speaks in singular for one pending movement and no template", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountInUseError(1, 0));

    expect(await archiveAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta todavía tiene 1 movimiento pendiente. Pasalo a otra cuenta o eliminalo antes de archivarla.",
    });
  });

  it("speaks only of templates when nothing is pending", async () => {
    mocks.archiveAccount.mockRejectedValue(new AccountInUseError(0, 2));

    expect(await archiveAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta todavía tiene 2 recurrentes. Pasalos a otra cuenta o eliminalos antes de archivarla.",
    });
  });
});

describe("unarchiveAccountAction", () => {
  it("brings the account of the authenticated user back and revalidates", async () => {
    mocks.unarchiveAccount.mockResolvedValue(undefined);

    expect(await unarchiveAccountAction("acc_1")).toEqual({
      status: "success",
    });
    expect(mocks.unarchiveAccount).toHaveBeenCalledWith(USER_ID, "acc_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
    ]);
  });

  it("explains that the bank must be reactivated first", async () => {
    mocks.unarchiveAccount.mockRejectedValue(new BankArchivedError());

    expect(await unarchiveAccountAction("acc_1")).toEqual({
      status: "error",
      message: "Este banco está archivado. Reactivalo primero.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account", async () => {
    mocks.unarchiveAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await unarchiveAccountAction("acc_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
  });
});

describe("deleteAccountAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteAccountAction("acc_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the account of the authenticated user and revalidates the banks, transfers, overview and cards pages", async () => {
    mocks.deleteAccount.mockResolvedValue(undefined);

    expect(await deleteAccountAction("acc_1")).toEqual({ status: "success" });
    expect(mocks.deleteAccount).toHaveBeenCalledTimes(1);
    expect(mocks.deleteAccount).toHaveBeenCalledWith(USER_ID, "acc_1");
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/dashboard/banks",
      "/dashboard/transfers",
      "/dashboard/overview",
      "/dashboard/cards",
    ]);
  });

  it("tells the user to archive the account when it has movements, and revalidates nothing", async () => {
    mocks.deleteAccount.mockRejectedValue(new AccountHasMovementsError());

    expect(await deleteAccountAction("acc_1")).toEqual({
      status: "error",
      message:
        "Esta cuenta ya tiene movimientos, así que no se puede eliminar. Archivala en su lugar.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 'not found' for another user's account", async () => {
    mocks.deleteAccount.mockRejectedValue(new AccountNotFoundError());

    expect(await deleteAccountAction("acc_of_someone_else")).toEqual({
      status: "error",
      message: "No se encontró la cuenta.",
    });
    expect(mocks.deleteAccount).toHaveBeenCalledTimes(1);
  });

  it("answers 'not found' without calling the service for a missing, empty or non-text id", async () => {
    const expected = { status: "error", message: "No se encontró la cuenta." };

    expect(await deleteAccountAction("")).toEqual(expected);
    expect(await deleteAccountAction(undefined as unknown as string)).toEqual(
      expected,
    );
    expect(await deleteAccountAction(42 as unknown as string)).toEqual(
      expected,
    );
    expect(mocks.deleteAccount).not.toHaveBeenCalled();
  });
});

describe("a crypto currency in an entity bank", () => {
  const MESSAGE =
    "Las entidades bancarias solo admiten monedas de curso legal. Usá una billetera virtual.";

  it("puts the refusal on the currency field of a new account", async () => {
    mocks.createAccount.mockRejectedValue(
      new CryptoCurrencyNotAllowedError("USDC"),
    );

    const result = await createAccountAction(formOf({ currency: "USDC" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [MESSAGE],
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts the same refusal on the currency field of an edit", async () => {
    mocks.updateAccount.mockRejectedValue(
      new CryptoCurrencyNotAllowedError("BTC"),
    );

    const result = await updateAccountAction(
      "acc_1",
      formOf({ currency: "BTC" }),
    );

    expect(result.status === "error" && result.fieldErrors).toEqual({
      currency: [MESSAGE],
    });
  });
});
