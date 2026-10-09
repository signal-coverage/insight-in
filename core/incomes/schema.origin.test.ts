import { describe, expect, it } from "vitest";

import { incomeInputSchema } from "./schema";

const validInput = {
  description: "September salary",
  amount: "12000.00",
  currency: "ARS",
  date: "2026-09-01",
  categoryId: "cat_1",
  notes: "",
  accountId: "acc_1",
};

const MISSING_CURRENCY = "Elegí la moneda de origen.";
const INVALID_AMOUNT = "Ingresá un monto de origen válido.";

const fieldErrors = (input: unknown): Record<string, string[]> => {
  const result = incomeInputSchema.safeParse(input);

  if (result.success) {
    return {};
  }

  const errors: Record<string, string[]> = {};

  result.error.issues.forEach((issue) => {
    const path = issue.path.join(".");

    errors[path] = [...(errors[path] ?? []), issue.message];
  });

  return errors;
};

describe("incomeInputSchema origin", () => {
  it("has no origin when neither field is sent", () => {
    expect(incomeInputSchema.safeParse(validInput).data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });

  it.each([undefined, "", "   "])(
    "treats an empty pair (%j) as no origin",
    (empty) => {
      const result = incomeInputSchema.safeParse({
        ...validInput,
        originCurrency: empty,
        originAmount: empty,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        originCurrency: null,
        originAmount: null,
      });
    },
  );

  it("accepts a crypto origin and converts its amount to millionths", () => {
    const result = incomeInputSchema.safeParse({
      ...validInput,
      originCurrency: "USDC",
      originAmount: "10.5",
    });

    expect(result.data).toMatchObject({
      amount: 1200000,
      currency: "ARS",
      originCurrency: "USDC",
      originAmount: 10500000,
    });
  });

  it("accepts an ISO origin different from the net currency, in its own decimals", () => {
    const result = incomeInputSchema.safeParse({
      ...validInput,
      originCurrency: "EUR",
      originAmount: "10.55",
    });

    expect(result.data).toMatchObject({
      originCurrency: "EUR",
      originAmount: 1055,
    });
  });

  it("trims both fields", () => {
    const result = incomeInputSchema.safeParse({
      ...validInput,
      originCurrency: " USDT ",
      originAmount: " 3 ",
    });

    expect(result.data).toMatchObject({
      originCurrency: "USDT",
      originAmount: 3000000,
    });
  });

  it("asks for the currency when only the amount is sent", () => {
    expect(fieldErrors({ ...validInput, originAmount: "10" })).toEqual({
      originCurrency: [MISSING_CURRENCY],
    });
  });

  it("asks for the amount when only the currency is sent", () => {
    expect(fieldErrors({ ...validInput, originCurrency: "USDC" })).toEqual({
      originAmount: [INVALID_AMOUNT],
    });
  });

  it("rejects a currency that is neither crypto nor supported", () => {
    expect(
      fieldErrors({ ...validInput, originCurrency: "XRP", originAmount: "1" }),
    ).toEqual({ originCurrency: [MISSING_CURRENCY] });
  });

  it("rejects an origin equal to the net currency", () => {
    expect(
      fieldErrors({ ...validInput, originCurrency: "ARS", originAmount: "1" }),
    ).toEqual({ originCurrency: [MISSING_CURRENCY] });
  });

  it("accepts the same crypto whatever the net currency", () => {
    expect(
      incomeInputSchema.safeParse({
        ...validInput,
        currency: "USD",
        originCurrency: "USDC",
        originAmount: "1000",
      }).success,
    ).toBe(true);
  });

  it.each(["abc", "-5", "1,5", "0", "0.000000", ".5", "1e3"])(
    "rejects the origin amount %j",
    (originAmount) => {
      expect(
        fieldErrors({ ...validInput, originCurrency: "USDC", originAmount }),
      ).toEqual({ originAmount: [INVALID_AMOUNT] });
    },
  );

  it("rejects more than 6 decimals for a crypto and more than the currency has for an ISO one", () => {
    expect(
      fieldErrors({
        ...validInput,
        originCurrency: "USDC",
        originAmount: "1.1234567",
      }),
    ).toEqual({ originAmount: [INVALID_AMOUNT] });
    expect(
      fieldErrors({
        ...validInput,
        originCurrency: "EUR",
        originAmount: "1.123",
      }),
    ).toEqual({ originAmount: [INVALID_AMOUNT] });
  });

  it("does not add origin errors on top of an unsupported net currency", () => {
    expect(
      fieldErrors({
        ...validInput,
        currency: "ZZZ",
        originCurrency: "USDC",
        originAmount: "1",
      }),
    ).toEqual({ currency: ["Selecciona una moneda compatible."] });
  });

  it("checks the origin of an income in a crypto currency like any other", () => {
    const usdc = { ...validInput, currency: "USDC", amount: "10" };

    expect(
      incomeInputSchema.safeParse({
        ...usdc,
        originCurrency: "ARS",
        originAmount: "12500",
      }).data,
    ).toMatchObject({
      currency: "USDC",
      amount: 10000000,
      originCurrency: "ARS",
      originAmount: 1250000,
    });
    expect(
      fieldErrors({ ...usdc, originCurrency: "ARS", originAmount: "1.234" }),
    ).toEqual({ originAmount: [INVALID_AMOUNT] });
    expect(
      fieldErrors({ ...usdc, originCurrency: "USDC", originAmount: "10" }),
    ).toEqual({ originCurrency: [MISSING_CURRENCY] });
  });
});
