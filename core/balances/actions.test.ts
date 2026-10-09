import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  saveOpeningBalances: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  saveOpeningBalances: mocks.saveOpeningBalances,
}));

import {
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";

import { saveOpeningBalanceAction } from "./actions";

const USER_ID = "user_123";

const payload = {
  month: "2026-06",
  balances: [
    { accountId: "acc_bank", currency: "ARS", amount: "1500.50" },
    { accountId: "acc_cash", currency: "ARS", amount: "200" },
  ],
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // 2026-10-15 in Argentina, whatever the machine's zone.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-15T15:00:00.000Z"));
  mocks.auth.mockResolvedValue({ userId: USER_ID });
  mocks.saveOpeningBalances.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("saveOpeningBalanceAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await saveOpeningBalanceAction(payload)).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.saveOpeningBalances).not.toHaveBeenCalled();
  });

  it("saves the validated amounts for the signed-in user", async () => {
    expect(await saveOpeningBalanceAction(payload)).toEqual({
      status: "success",
    });
    expect(mocks.saveOpeningBalances).toHaveBeenCalledWith(USER_ID, {
      month: "2026-06",
      amounts: [
        { accountId: "acc_bank", currency: "ARS", amount: 150050 },
        { accountId: "acc_cash", currency: "ARS", amount: 20000 },
      ],
    });
  });

  it("takes the owner from the session, never from the payload", async () => {
    await saveOpeningBalanceAction({
      ...payload,
      userId: "someone_else",
    } as never);

    expect(mocks.saveOpeningBalances.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.saveOpeningBalances.mock.calls[0][1]).not.toHaveProperty(
      "userId",
    );
  });

  it("refreshes the summary, where the balances show", async () => {
    await saveOpeningBalanceAction(payload);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/overview");
  });

  it("refreshes the Banks board too, where the balances include the opening amounts", async () => {
    await saveOpeningBalanceAction(payload);

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/banks");
    expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("refuses a month that has not started yet and saves nothing", async () => {
    const result = await saveOpeningBalanceAction({
      ...payload,
      month: "2026-11",
    });

    expect(result).toMatchObject({
      status: "error",
      fieldErrors: {
        month: [
          "El mes inicial no puede ser posterior al actual. Elegí el mes actual o uno anterior.",
        ],
      },
    });
    expect(mocks.saveOpeningBalances).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("points at the field with an invalid amount and saves nothing", async () => {
    const result = await saveOpeningBalanceAction({
      ...payload,
      balances: [{ accountId: "acc_bank", currency: "ARS", amount: "-3" }],
    });

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        "balances.0.amount": [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
      },
    });
    expect(mocks.saveOpeningBalances).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("points at the month when it is not valid", async () => {
    const result = await saveOpeningBalanceAction({
      ...payload,
      month: "2026-13",
    });

    expect(result.status).toBe("error");
    expect(result).toMatchObject({
      fieldErrors: { month: ["Selecciona un mes válido."] },
    });
  });

  it("refuses something that is not a payload", async () => {
    const result = await saveOpeningBalanceAction("nope" as never);

    expect(result.status).toBe("error");
    expect(mocks.saveOpeningBalances).not.toHaveBeenCalled();
  });

  it("asks to reopen the editor when an account changed meanwhile (gone, another user's or another currency)", async () => {
    for (const error of [
      new AccountNotFoundError(),
      new AccountCurrencyMismatchError(),
    ]) {
      mocks.saveOpeningBalances.mockRejectedValueOnce(error);

      expect(await saveOpeningBalanceAction(payload)).toEqual({
        status: "error",
        message:
          "Tus cuentas cambiaron mientras editabas. Cerrá el saldo inicial y volvé a abrirlo.",
      });
    }
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("answers with a generic message when saving fails, without refreshing", async () => {
    mocks.saveOpeningBalances.mockRejectedValue(new Error("database down"));

    expect(await saveOpeningBalanceAction(payload)).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
