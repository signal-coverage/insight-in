import { describe, expect, it } from "vitest";

import { cardInputSchema } from "./schema";

const form = (patch: Record<string, string | undefined> = {}) => ({
  last4: "1234",
  brand: "VISA",
  closingDay: "25",
  dueDay: "5",
  currency: "ARS",
  limitMode: "MONTHLY",
  limitAmount: "300000",
  ...patch,
});

const errorsOf = (patch: Record<string, string | undefined>) => {
  const result = cardInputSchema.safeParse(form(patch));

  if (result.success) {
    throw new Error("expected the form to be rejected");
  }

  return result.error.issues.map(({ path, message }) => ({
    field: path[0],
    message,
  }));
};

describe("cardInputSchema", () => {
  it("turns a valid form into the stored shape, with the cap in minor units", () => {
    expect(cardInputSchema.parse(form())).toEqual({
      last4: "1234",
      brand: "VISA",
      closingDay: 25,
      dueDay: 5,
      currency: "ARS",
      limitMode: "MONTHLY",
      limitAmount: 30000000,
    });
  });

  it("converts the cap with the decimals of its currency", () => {
    expect(
      cardInputSchema.parse(form({ limitAmount: "1200.50" })).limitAmount,
    ).toBe(120050);
    expect(
      cardInputSchema.parse(form({ currency: "JPY", limitAmount: "1200" }))
        .limitAmount,
    ).toBe(1200);
  });

  it("accepts either mode and every brand", () => {
    expect(cardInputSchema.parse(form({ limitMode: "TOTAL" })).limitMode).toBe(
      "TOTAL",
    );
    expect(cardInputSchema.parse(form({ brand: "MASTERCARD" })).brand).toBe(
      "MASTERCARD",
    );
    expect(cardInputSchema.parse(form({ brand: "OTHER" })).brand).toBe("OTHER");
  });

  it("trims the digits and the days", () => {
    const parsed = cardInputSchema.parse(
      form({ last4: " 0042 ", closingDay: " 7 ", dueDay: "31 " }),
    );

    expect(parsed).toMatchObject({ last4: "0042", closingDay: 7, dueDay: 31 });
  });

  describe("last4", () => {
    it.each(["123", "12345", "12a4", "", "١٢٣٤", "12 34", "-123"])(
      "rejects %j",
      (last4) => {
        expect(errorsOf({ last4 })).toEqual([
          { field: "last4", message: "Ingresá exactamente 4 dígitos." },
        ]);
      },
    );

    it("is required", () => {
      expect(errorsOf({ last4: undefined })).toEqual([
        {
          field: "last4",
          message: "Los últimos 4 dígitos son obligatorios.",
        },
      ]);
    });

    it("keeps leading zeros", () => {
      expect(cardInputSchema.parse(form({ last4: "0007" })).last4).toBe("0007");
    });
  });

  describe("brand", () => {
    it.each(["AMEX", "visa", ""])("rejects %j", (brand) => {
      expect(errorsOf({ brand })).toEqual([
        { field: "brand", message: "Seleccioná una marca válida." },
      ]);
    });

    it("is required", () => {
      expect(errorsOf({ brand: undefined })).toEqual([
        { field: "brand", message: "Seleccioná una marca válida." },
      ]);
    });
  });

  describe.each([
    ["closingDay", "El día de cierre"],
    ["dueDay", "El día de vencimiento"],
  ])("%s", (field, label) => {
    it.each(["0", "32", "-1", "1.5", "abc", "", "100", "1e1"])(
      "rejects %j",
      (value) => {
        expect(errorsOf({ [field]: value })).toEqual([
          {
            field,
            message: `${label} debe ser un número entero entre 1 y 31.`,
          },
        ]);
      },
    );

    it("is required", () => {
      expect(errorsOf({ [field]: undefined })).toEqual([
        { field, message: `${label} es obligatorio.` },
      ]);
    });

    it.each([
      ["1", 1],
      ["31", 31],
      ["09", 9],
    ])("accepts %j", (value, expected) => {
      expect(
        cardInputSchema.parse(form({ [field]: value }))[field as "dueDay"],
      ).toBe(expected);
    });
  });

  describe("currency", () => {
    it("rejects an unsupported one", () => {
      expect(errorsOf({ currency: "XXX" })).toEqual([
        { field: "currency", message: "Selecciona una moneda compatible." },
      ]);
    });

    it("is required", () => {
      expect(errorsOf({ currency: undefined })).toEqual([
        { field: "currency", message: "La moneda es obligatoria." },
      ]);
    });
  });

  describe("limitMode", () => {
    it.each(["WEEKLY", "monthly", ""])("rejects %j", (limitMode) => {
      expect(errorsOf({ limitMode })).toEqual([
        { field: "limitMode", message: "Seleccioná el tipo de tope." },
      ]);
    });
  });

  describe("limitAmount", () => {
    it.each(["abc", "1,5", "1.234", "-5", ""])("rejects %j", (limitAmount) => {
      expect(errorsOf({ limitAmount })).toEqual([
        {
          field: "limitAmount",
          message:
            "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        },
      ]);
    });

    it("must be above zero", () => {
      expect(errorsOf({ limitAmount: "0" })).toEqual([
        { field: "limitAmount", message: "El monto debe ser mayor que cero." },
      ]);
    });

    it("is required", () => {
      expect(errorsOf({ limitAmount: undefined })).toEqual([
        { field: "limitAmount", message: "El monto es obligatorio." },
      ]);
    });

    it("is not checked against an unsupported currency, which is already reported", () => {
      expect(errorsOf({ currency: "XXX", limitAmount: "abc" })).toEqual([
        { field: "currency", message: "Selecciona una moneda compatible." },
      ]);
    });
  });

  it("reports every wrong field at once", () => {
    const fields = errorsOf({ last4: "1", dueDay: "40", limitAmount: "0" }).map(
      ({ field }) => field,
    );

    expect(fields.sort()).toEqual(["dueDay", "last4", "limitAmount"]);
  });
});
