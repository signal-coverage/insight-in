import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  revalidatePath: vi.fn(),
  createCard: vi.fn(),
  updateCard: vi.fn(),
  deleteCard: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("./service", () => ({
  createCard: mocks.createCard,
  updateCard: mocks.updateCard,
  deleteCard: mocks.deleteCard,
}));

import {
  CardHasPendingExpensesError,
  CardNotFoundError,
  DuplicateCardError,
} from "./errors";
import {
  createCardAction,
  deleteCardAction,
  updateCardAction,
} from "./actions";

const USER_ID = "user_123";

const formOf = (patch: Record<string, string> = {}): FormData => {
  const values: Record<string, string> = {
    last4: "1234",
    brand: "VISA",
    closingDay: "25",
    dueDay: "5",
    currency: "ARS",
    limitMode: "MONTHLY",
    limitAmount: "300000",
    ...patch,
  };
  const formData = new FormData();

  Object.entries(values).forEach(([key, value]) => formData.set(key, value));

  return formData;
};

const STORED = {
  last4: "1234",
  brand: "VISA",
  closingDay: 25,
  dueDay: 5,
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: 30000000,
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  mocks.auth.mockResolvedValue({ userId: USER_ID });
});

describe("createCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await createCardAction(
      formOf({ last4: "12", closingDay: "40", limitAmount: "abc" }),
    );

    expect(result.status === "error" && result.message).toBe(
      "Corrige los campos resaltados.",
    );
    expect(result.status === "error" && result.fieldErrors).toEqual({
      last4: ["Ingresá exactamente 4 dígitos."],
      closingDay: ["El día de cierre debe ser un número entero entre 1 y 31."],
      limitAmount: [
        "Ingresa un monto válido, con dígitos y un punto para los decimales.",
      ],
    });
    expect(mocks.createCard).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("creates the card for the authenticated user, with the cap in minor units", async () => {
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    expect(await createCardAction(formOf())).toEqual({ status: "success" });
    expect(mocks.createCard).toHaveBeenCalledWith(USER_ID, STORED);
  });

  it("ignores a userId in the form", async () => {
    const formData = formOf();

    formData.set("userId", "attacker");
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    await createCardAction(formData);

    expect(mocks.createCard.mock.calls[0][0]).toBe(USER_ID);
    expect(mocks.createCard.mock.calls[0][1]).not.toHaveProperty("userId");
  });

  it("revalidates the cards page", async () => {
    mocks.createCard.mockResolvedValue({ id: "card_1", ...STORED });

    await createCardAction(formOf());

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("puts a duplicate card on the last four digits field", async () => {
    mocks.createCard.mockRejectedValue(new DuplicateCardError("VISA", "1234"));

    const result = await createCardAction(formOf());

    expect(result).toEqual({
      status: "error",
      message: "Corrige los campos resaltados.",
      fieldErrors: { last4: ["Ya tenés una tarjeta Visa terminada en 1234."] },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("names the brand of the duplicate", async () => {
    mocks.createCard.mockRejectedValue(
      new DuplicateCardError("MASTERCARD", "0007"),
    );

    const result = await createCardAction(formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      last4: ["Ya tenés una tarjeta Mastercard terminada en 0007."],
    });
  });

  it("returns a generic error when the service fails", async () => {
    mocks.createCard.mockRejectedValue(new Error("db down"));

    expect(await createCardAction(formOf())).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});

describe("updateCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await updateCardAction("card_1", formOf())).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("returns field errors for invalid input without touching the service", async () => {
    const result = await updateCardAction("card_1", formOf({ brand: "AMEX" }));

    expect(result.status === "error" && result.fieldErrors).toEqual({
      brand: ["Seleccioná una marca válida."],
    });
    expect(mocks.updateCard).not.toHaveBeenCalled();
  });

  it("updates the card of the authenticated user and revalidates the page", async () => {
    mocks.updateCard.mockResolvedValue(undefined);

    expect(
      await updateCardAction("card_1", formOf({ limitMode: "TOTAL" })),
    ).toEqual({ status: "success" });
    expect(mocks.updateCard).toHaveBeenCalledWith(USER_ID, "card_1", {
      ...STORED,
      limitMode: "TOTAL",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.updateCard.mockRejectedValue(new CardNotFoundError());

    expect(await updateCardAction("card_9", formOf())).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("puts a duplicate card on the last four digits field", async () => {
    mocks.updateCard.mockRejectedValue(new DuplicateCardError("OTHER", "4321"));

    const result = await updateCardAction("card_1", formOf());

    expect(result.status === "error" && result.fieldErrors).toEqual({
      last4: ["Ya tenés una tarjeta Otra terminada en 4321."],
    });
  });
});

describe("deleteCardAction", () => {
  it("rejects unauthenticated callers without touching the service", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    expect(await deleteCardAction("card_1")).toEqual({
      status: "error",
      message: "Debes iniciar sesión.",
    });
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });

  it("deletes the card of the authenticated user and revalidates the page", async () => {
    mocks.deleteCard.mockResolvedValue(undefined);

    expect(await deleteCardAction("card_1")).toEqual({ status: "success" });
    expect(mocks.deleteCard).toHaveBeenCalledWith(USER_ID, "card_1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/cards");
  });

  it("explains why a card with pending installments cannot be deleted", async () => {
    mocks.deleteCard.mockRejectedValue(new CardHasPendingExpensesError());

    expect(await deleteCardAction("card_1")).toEqual({
      status: "error",
      message:
        "Esta tarjeta tiene gastos pendientes. Terminá de pagarlos o cambiá su tarjeta antes de eliminarla.",
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("says the card was not found when it is not the user's", async () => {
    mocks.deleteCard.mockRejectedValue(new CardNotFoundError());

    expect(await deleteCardAction("card_9")).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
  });

  it("refuses an id that is not a text without touching the service", async () => {
    const result = await deleteCardAction(undefined as never);

    expect(result).toEqual({
      status: "error",
      message: "No se encontró la tarjeta.",
    });
    expect(mocks.deleteCard).not.toHaveBeenCalled();
  });

  it("returns a generic error when the service fails", async () => {
    mocks.deleteCard.mockRejectedValue(new Error("db down"));

    expect(await deleteCardAction("card_1")).toEqual({
      status: "error",
      message: "Algo salió mal. Inténtalo de nuevo.",
    });
  });
});
