import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ auth: vi.fn() }));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));

import {
  AccountArchivedError,
  AccountCurrencyMismatchError,
  AccountNotFoundError,
} from "@/core/accounts/errors";
import { CardKindNotAllowedError } from "@/core/cards/errors";

import { runAuthenticated } from "./actionHelpers";

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: "user_123" });
});

const failWith = (error: Error) =>
  runAuthenticated("test", async () => {
    throw error;
  });

describe("runAuthenticated and the account of an entry", () => {
  it("puts an unknown or foreign account on the Cuenta field", async () => {
    expect(await failWith(new AccountNotFoundError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { accountId: ["Elegí una cuenta válida."] },
    });
  });

  it("puts an archived account on the Cuenta field", async () => {
    expect(await failWith(new AccountArchivedError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta está archivada. Elegí otra o reactivala en Bancos.",
        ],
      },
    });
  });

  it("puts an account in another currency on the Cuenta field", async () => {
    expect(await failWith(new AccountCurrencyMismatchError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: {
        accountId: [
          "Esta cuenta es de otra moneda. Elegí una cuenta en la moneda del movimiento.",
        ],
      },
    });
  });

  it("does not log these: they are the user's to fix", async () => {
    await failWith(new AccountArchivedError());

    expect(console.error).not.toHaveBeenCalled();
  });
});

describe("runAuthenticated and the card of a purchase", () => {
  it("puts a card of the wrong kind on the Tarjeta field", async () => {
    expect(await failWith(new CardKindNotAllowedError())).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { cardId: ["Elegí una tarjeta de crédito."] },
    });
  });
});
