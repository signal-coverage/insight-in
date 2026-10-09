import { describe, expect, it } from "vitest";

import { expenseInputSchema } from "./schema";

const validInput = {
  description: "Netflix",
  amount: "35000.00",
  currency: "ARS",
  date: "2026-09-01",
  categoryId: "cat_1",
  accountId: "acc_1",
  notes: "",
};

const MISSING_CURRENCY = "Elegí la moneda de origen.";
const INVALID_AMOUNT = "Ingresá un monto de origen válido.";

const fieldErrors = (input: unknown): Record<string, string[]> => {
  const result = expenseInputSchema.safeParse(input);

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

describe("expenseInputSchema origin", () => {
  it("has no origin when neither field is sent", () => {
    expect(expenseInputSchema.safeParse(validInput).data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });

  it.each([undefined, "", "   "])(
    "treats an empty pair (%j) as no origin",
    (empty) => {
      const result = expenseInputSchema.safeParse({
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

  it("accepts an ISO price in another currency and keeps the real amount untouched", () => {
    const result = expenseInputSchema.safeParse({
      ...validInput,
      originCurrency: "USD",
      originAmount: "20",
    });

    expect(result.data).toMatchObject({
      amount: 3500000,
      currency: "ARS",
      originCurrency: "USD",
      originAmount: 2000,
    });
  });

  it("accepts a crypto price and converts its amount to millionths", () => {
    const result = expenseInputSchema.safeParse({
      ...validInput,
      originCurrency: "USDT",
      originAmount: "20.5",
    });

    expect(result.data).toMatchObject({
      originCurrency: "USDT",
      originAmount: 20500000,
    });
  });

  it("asks for the currency when only the amount is sent", () => {
    expect(fieldErrors({ ...validInput, originAmount: "20" })).toEqual({
      originCurrency: [MISSING_CURRENCY],
    });
  });

  it("asks for the amount when only the currency is sent", () => {
    expect(fieldErrors({ ...validInput, originCurrency: "USD" })).toEqual({
      originAmount: [INVALID_AMOUNT],
    });
  });

  it("rejects an origin equal to the currency of the expense", () => {
    expect(
      fieldErrors({ ...validInput, originCurrency: "ARS", originAmount: "1" }),
    ).toEqual({ originCurrency: [MISSING_CURRENCY] });
  });

  it("rejects a currency that is neither crypto nor supported", () => {
    expect(
      fieldErrors({ ...validInput, originCurrency: "XRP", originAmount: "1" }),
    ).toEqual({ originCurrency: [MISSING_CURRENCY] });
  });

  it.each(["abc", "-5", "1,5", "0", "1e3"])(
    "rejects the origin amount %j",
    (originAmount) => {
      expect(
        fieldErrors({ ...validInput, originCurrency: "USD", originAmount }),
      ).toEqual({ originAmount: [INVALID_AMOUNT] });
    },
  );

  it("rejects more decimals than the origin currency has", () => {
    expect(
      fieldErrors({
        ...validInput,
        originCurrency: "USD",
        originAmount: "1.123",
      }),
    ).toEqual({ originAmount: [INVALID_AMOUNT] });
  });
});
