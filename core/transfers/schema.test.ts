import { describe, expect, it } from "vitest";
import { z } from "zod";

import { transferInputSchema } from "./schema";

const VALID = {
  currency: "ARS",
  fromAccountId: "acc_1",
  toAccountId: "acc_2",
  amount: "1500.50",
  date: "2026-10-06",
  notes: "  Alquiler  ",
};

const parse = (patch: Record<string, unknown> = {}) =>
  transferInputSchema.safeParse({ ...VALID, ...patch });

const errorsOf = (patch: Record<string, unknown>) => {
  const result = parse(patch);

  if (result.success) {
    throw new Error("expected the input to be rejected");
  }

  return z.flattenError(result.error).fieldErrors;
};

describe("transferInputSchema", () => {
  it("turns a valid form into the persisted shape, with the amount in minor units and trimmed notes", () => {
    expect(parse()).toMatchObject({
      success: true,
      data: {
        currency: "ARS",
        fromAccountId: "acc_1",
        toAccountId: "acc_2",
        amount: 150050,
        date: "2026-10-06",
        notes: "Alquiler",
      },
    });
  });

  it("reads the amount with the decimals of the currency", () => {
    expect(parse({ currency: "USD", amount: "0.01" })).toMatchObject({
      success: true,
      data: { amount: 1 },
    });
  });

  it("stores no notes when they are blank or missing", () => {
    expect(parse({ notes: "   " })).toMatchObject({
      success: true,
      data: { notes: null },
    });
    expect(parse({ notes: undefined })).toMatchObject({
      success: true,
      data: { notes: null },
    });
  });

  it("keeps only its own fields: an owner or an id in the payload never gets through", () => {
    const result = parse({ userId: "attacker", id: "x" });

    expect(result.success && Object.keys(result.data).sort()).toEqual([
      "amount",
      "currency",
      "date",
      "fromAccountId",
      "notes",
      "toAccountId",
    ]);
  });

  it("asks for both accounts, each with its own message", () => {
    expect(
      errorsOf({ fromAccountId: undefined, toAccountId: "" }),
    ).toMatchObject({
      fromAccountId: ["Elegí la cuenta de origen."],
      toAccountId: ["Elegí la cuenta de destino."],
    });
  });

  it("refuses the same account on both sides, on the destination field", () => {
    expect(errorsOf({ toAccountId: "acc_1" }).toAccountId).toEqual([
      "El origen y el destino tienen que ser cuentas distintas.",
    ]);
  });

  it.each([
    ["0", "El monto debe ser mayor que cero."],
    ["0.00", "El monto debe ser mayor que cero."],
    [
      "-5",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    [
      "abc",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    [
      "1.234",
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ],
    ["", "Ingresa un monto válido, con dígitos y un punto para los decimales."],
  ])("refuses the amount %j", (amount, message) => {
    expect(errorsOf({ amount }).amount).toEqual([message]);
  });

  it("refuses an unsupported currency and does not also complain about the amount", () => {
    const errors = errorsOf({ currency: "XXX" });

    expect(errors.currency).toEqual(["Selecciona una moneda compatible."]);
    expect(errors.amount).toBeUndefined();
  });

  it("refuses a date the calendar does not have", () => {
    expect(errorsOf({ date: "2026-02-30" }).date).toEqual([
      "Ingresa una fecha válida.",
    ]);
  });

  it("refuses a date outside the years the app can show (2000 to 2099)", () => {
    const message = "Ingresá una fecha entre los años 2000 y 2099.";

    expect(errorsOf({ date: "1999-12-31" }).date).toEqual([message]);
    expect(errorsOf({ date: "2100-01-01" }).date).toEqual([message]);
    expect(parse({ date: "2000-01-01" }).success).toBe(true);
  });

  it("refuses notes longer than the limit", () => {
    expect(errorsOf({ notes: "a".repeat(1001) }).notes).toEqual([
      "Las notas admiten como máximo 1000 caracteres.",
    ]);
  });

  it("parses a transfer in a crypto currency in millionths", () => {
    expect(parse({ currency: "USDC", amount: "1.5" })).toMatchObject({
      success: true,
      data: { currency: "USDC", amount: 1500000 },
    });
    expect(errorsOf({ currency: "USDC", amount: "1.1234567" }).amount).toEqual([
      "Ingresa un monto válido, con dígitos y un punto para los decimales.",
    ]);
  });
});
