import { describe, expect, it } from "vitest";

import { parseCardInput } from "./schema";

const credit = (patch: Record<string, unknown> = {}) => ({
  kind: "CREDIT",
  bankId: "bank_1",
  last4: "1234",
  brand: "VISA",
  closingDay: "25",
  dueDay: "5",
  limitMode: "MONTHLY",
  limits: [{ currency: "ARS", amount: "300000" }],
  ...patch,
});

const debit = (patch: Record<string, unknown> = {}) => ({
  kind: "DEBIT",
  bankId: "bank_1",
  last4: "9999",
  brand: "MASTERCARD",
  limits: [],
  ...patch,
});

const errorsOf = (values: Record<string, unknown>) => {
  const result = parseCardInput(values);

  if (result.success) {
    throw new Error("expected the form to be rejected");
  }

  return result.fieldErrors;
};

const DEBIT_FIELDS =
  "Una tarjeta de débito o prepaga no tiene cierre, vencimiento ni tope.";

describe("parseCardInput", () => {
  it("asks for the kind before anything else", () => {
    expect(errorsOf(credit({ kind: "GOLD" }))).toEqual({
      kind: ["Elegí el tipo de tarjeta."],
    });
    expect(errorsOf(credit({ kind: undefined }))).toEqual({
      kind: ["Elegí el tipo de tarjeta."],
    });
  });

  describe("a credit card", () => {
    it("turns a valid form into the stored shape, each cap in minor units of its currency, by currency", () => {
      expect(
        parseCardInput(
          credit({
            limits: [
              { currency: "USD", amount: "1000.50" },
              { currency: "ARS", amount: "300000" },
            ],
          }),
        ),
      ).toEqual({
        success: true,
        data: {
          kind: "CREDIT",
          bankId: "bank_1",
          last4: "1234",
          brand: "VISA",
          closingDay: 25,
          dueDay: 5,
          limitMode: "MONTHLY",
          limits: [
            { currency: "ARS", amount: 30000000 },
            { currency: "USD", amount: 100050 },
          ],
        },
      });
    });

    it("needs at least one cap", () => {
      expect(errorsOf(credit({ limits: [] }))).toEqual({
        limits: ["Agregá al menos un tope."],
      });
    });

    it("refuses a second cap in the same currency, on that row", () => {
      expect(
        errorsOf(
          credit({
            limits: [
              { currency: "ARS", amount: "1" },
              { currency: "ARS", amount: "2" },
            ],
          }),
        ),
      ).toEqual({ "limits.1.currency": ["Ya hay un tope en esa moneda."] });
    });

    it("checks each cap's amount on its own row", () => {
      expect(
        errorsOf(
          credit({
            limits: [
              { currency: "ARS", amount: "10" },
              { currency: "USD", amount: "0" },
            ],
          }),
        ),
      ).toEqual({ "limits.1.amount": ["El monto debe ser mayor que cero."] });
      expect(
        errorsOf(credit({ limits: [{ currency: "ARS", amount: "abc" }] })),
      ).toEqual({
        "limits.0.amount": [
          "Ingresa un monto válido, con dígitos y un punto para los decimales.",
        ],
      });
    });

    it("refuses a currency the app does not support, on its row", () => {
      expect(
        errorsOf(credit({ limits: [{ currency: "XXX", amount: "10" }] })),
      ).toEqual({ "limits.0.currency": ["Selecciona una moneda compatible."] });
    });

    it("keeps the rules of the last four digits, the brand, the days and the mode", () => {
      expect(
        errorsOf(
          credit({
            last4: "12",
            brand: "AMEX",
            closingDay: "40",
            limitMode: "SOMETIMES",
          }),
        ),
      ).toEqual({
        last4: ["Ingresá exactamente 4 dígitos."],
        brand: ["Seleccioná una marca válida."],
        closingDay: [
          "El día de cierre debe ser un número entero entre 1 y 31.",
        ],
        limitMode: ["Seleccioná el tipo de tope."],
      });
    });

    it("converts each cap with the decimals of its currency", () => {
      const result = (limit: { currency: string; amount: string }) => {
        const parsed = parseCardInput(credit({ limits: [limit] }));

        return parsed.success && parsed.data.kind === "CREDIT"
          ? parsed.data.limits[0].amount
          : null;
      };

      expect(result({ currency: "ARS", amount: "1200.50" })).toBe(120050);
      expect(result({ currency: "JPY", amount: "1200" })).toBe(1200);
    });

    it("accepts either mode and every brand", () => {
      const dataOf = (patch: Record<string, unknown>) => {
        const parsed = parseCardInput(credit(patch));

        return parsed.success ? parsed.data : null;
      };

      expect(dataOf({ limitMode: "TOTAL" })).toMatchObject({
        limitMode: "TOTAL",
      });
      expect(dataOf({ brand: "MASTERCARD" })).toMatchObject({
        brand: "MASTERCARD",
      });
      expect(dataOf({ brand: "OTHER" })).toMatchObject({ brand: "OTHER" });
    });

    it("trims the digits and the days", () => {
      expect(
        parseCardInput(
          credit({ last4: " 0042 ", closingDay: " 7 ", dueDay: "31 " }),
        ),
      ).toMatchObject({
        success: true,
        data: { last4: "0042", closingDay: 7, dueDay: 31 },
      });
    });

    describe("last4", () => {
      it.each(["123", "12345", "12a4", "", "١٢٣٤", "12 34", "-123"])(
        "rejects %j",
        (last4) => {
          expect(errorsOf(credit({ last4 }))).toEqual({
            last4: ["Ingresá exactamente 4 dígitos."],
          });
        },
      );

      it("is required", () => {
        expect(errorsOf(credit({ last4: undefined }))).toEqual({
          last4: ["Los últimos 4 dígitos son obligatorios."],
        });
      });

      it("keeps leading zeros", () => {
        expect(parseCardInput(credit({ last4: "0007" }))).toMatchObject({
          success: true,
          data: { last4: "0007" },
        });
      });
    });

    describe.each([
      ["closingDay", "El día de cierre"],
      ["dueDay", "El día de vencimiento"],
    ])("%s", (field, label) => {
      it.each(["0", "32", "-1", "1.5", "abc", "", "100", "1e1"])(
        "rejects %j",
        (value) => {
          expect(errorsOf(credit({ [field]: value }))).toEqual({
            [field]: [`${label} debe ser un número entero entre 1 y 31.`],
          });
        },
      );

      it("is required", () => {
        expect(errorsOf(credit({ [field]: undefined }))).toEqual({
          [field]: [`${label} es obligatorio.`],
        });
      });

      it.each([
        ["1", 1],
        ["31", 31],
        ["09", 9],
      ])("accepts %j", (value, expected) => {
        expect(parseCardInput(credit({ [field]: value }))).toMatchObject({
          success: true,
          data: { [field]: expected },
        });
      });
    });

    describe("limitMode", () => {
      it.each(["WEEKLY", "monthly", ""])("rejects %j", (limitMode) => {
        expect(errorsOf(credit({ limitMode }))).toEqual({
          limitMode: ["Seleccioná el tipo de tope."],
        });
      });

      it("is required", () => {
        expect(errorsOf(credit({ limitMode: undefined }))).toEqual({
          limitMode: ["Seleccioná el tipo de tope."],
        });
      });
    });

    describe("a cap's amount", () => {
      it.each(["abc", "1,5", "1.234", "-5", ""])("rejects %j", (amount) => {
        expect(
          errorsOf(credit({ limits: [{ currency: "ARS", amount }] })),
        ).toEqual({
          "limits.0.amount": [
            "Ingresa un monto válido, con dígitos y un punto para los decimales.",
          ],
        });
      });

      it("is required", () => {
        expect(errorsOf(credit({ limits: [{ currency: "ARS" }] }))).toEqual({
          "limits.0.amount": ["El monto es obligatorio."],
        });
      });
    });

    it("reports every wrong field at once", () => {
      const fields = Object.keys(
        errorsOf(
          credit({
            last4: "1",
            dueDay: "40",
            limits: [{ currency: "ARS", amount: "0" }],
          }),
        ),
      );

      expect(fields.sort()).toEqual(["dueDay", "last4", "limits.0.amount"]);
    });

    it("requires the bank", () => {
      expect(errorsOf(credit({ bankId: "  " }))).toEqual({
        bankId: ["Elegí el banco de la tarjeta."],
      });
      expect(errorsOf(credit({ bankId: undefined }))).toEqual({
        bankId: ["Elegí el banco de la tarjeta."],
      });
    });

    it("keeps only its own fields: an owner or an id never gets through", () => {
      const result = parseCardInput(credit({ userId: "attacker", id: "x" }));

      expect(result.success && Object.keys(result.data).sort()).toEqual([
        "bankId",
        "brand",
        "closingDay",
        "dueDay",
        "kind",
        "last4",
        "limitMode",
        "limits",
      ]);
    });
  });

  describe("a debit or prepaid card", () => {
    it("is only the kind, the bank, the last four digits and the brand", () => {
      expect(parseCardInput(debit({ userId: "attacker" }))).toEqual({
        success: true,
        data: {
          kind: "DEBIT",
          bankId: "bank_1",
          last4: "9999",
          brand: "MASTERCARD",
        },
      });
    });

    it("refuses any field only a credit card has", () => {
      expect(
        errorsOf(
          debit({
            closingDay: "25",
            dueDay: "5",
            limitMode: "MONTHLY",
            limits: [{ currency: "ARS", amount: "1" }],
          }),
        ),
      ).toEqual({
        closingDay: [DEBIT_FIELDS],
        dueDay: [DEBIT_FIELDS],
        limitMode: [DEBIT_FIELDS],
        limits: [DEBIT_FIELDS],
      });
    });

    it("refuses a cap in a crypto currency, on its row: caps are legal tender", () => {
      expect(
        errorsOf(credit({ limits: [{ currency: "USDC", amount: "10" }] })),
      ).toEqual({ "limits.0.currency": ["Selecciona una moneda compatible."] });
      expect(
        parseCardInput(credit({ limits: [{ currency: "USD", amount: "10" }] }))
          .success,
      ).toBe(true);
    });
  });
});
