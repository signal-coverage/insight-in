import { describe, expect, it } from "vitest";

import { recurringExpenseInputSchema } from "./recurringSchema";

const validInput = {
  description: "Monthly rent",
  amount: "350000.50",
  currency: "ARS",
  categoryId: "cat_1",
  notes: "Paid by transfer",
  medium: "CASH",
  dayOfMonth: "5",
};

const errorPaths = (input: unknown): string[] => {
  const result = recurringExpenseInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("recurringExpenseInputSchema", () => {
  it("parses a valid input, converting the amount to minor units and the day to a number", () => {
    expect(recurringExpenseInputSchema.safeParse(validInput).data).toEqual({
      description: "Monthly rent",
      amount: 35000050,
      currency: "ARS",
      categoryId: "cat_1",
      notes: "Paid by transfer",
      medium: "CASH",
      originCurrency: null,
      originAmount: null,
      dayOfMonth: 5,
    });
  });

  it("keeps the reference price the template remembers, with its amount in minor units", () => {
    const result = recurringExpenseInputSchema.safeParse({
      ...validInput,
      originCurrency: "USD",
      originAmount: "20",
    });

    expect(result.data).toMatchObject({
      amount: 35000050,
      originCurrency: "USD",
      originAmount: 2000,
    });
  });

  it("treats an empty pair as no reference price", () => {
    const result = recurringExpenseInputSchema.safeParse({
      ...validInput,
      originCurrency: "",
      originAmount: "",
    });

    expect(result.data).toMatchObject({
      originCurrency: null,
      originAmount: null,
    });
  });

  it("asks for the missing half of the reference price", () => {
    expect(errorPaths({ ...validInput, originAmount: "20" })).toEqual([
      "originCurrency",
    ]);
    expect(errorPaths({ ...validInput, originCurrency: "USD" })).toEqual([
      "originAmount",
    ]);
  });

  it("rejects a reference price in the currency of the template", () => {
    expect(
      errorPaths({ ...validInput, originCurrency: "ARS", originAmount: "1" }),
    ).toEqual(["originCurrency"]);
  });

  it("defaults the medium to digital and turns empty notes into null", () => {
    const result = recurringExpenseInputSchema.safeParse({
      ...validInput,
      medium: undefined,
      notes: "  ",
    });

    expect(result.data?.medium).toBe("DIGITAL");
    expect(result.data?.notes).toBeNull();
  });

  it("requires a description, an amount, a currency, a category and a day", () => {
    expect(errorPaths({})).toEqual([
      "description",
      "amount",
      "currency",
      "categoryId",
      "dayOfMonth",
    ]);
  });

  it("rejects an amount that is not a positive number in the currency", () => {
    expect(errorPaths({ ...validInput, amount: "abc" })).toEqual(["amount"]);
    expect(errorPaths({ ...validInput, amount: "0" })).toEqual(["amount"]);
  });

  it("rejects an unsupported currency", () => {
    expect(errorPaths({ ...validInput, currency: "XYZ" })).toEqual([
      "currency",
    ]);
  });

  it("accepts the days 1 to 31, with surrounding spaces", () => {
    expect(
      recurringExpenseInputSchema.safeParse({ ...validInput, dayOfMonth: "1" })
        .data?.dayOfMonth,
    ).toBe(1);
    expect(
      recurringExpenseInputSchema.safeParse({
        ...validInput,
        dayOfMonth: " 31 ",
      }).data?.dayOfMonth,
    ).toBe(31);
  });

  it.each(["0", "32", "-1", "1.5", "abc", "", "05x"])(
    "rejects %j as the day of the month",
    (dayOfMonth) => {
      expect(errorPaths({ ...validInput, dayOfMonth })).toEqual(["dayOfMonth"]);
    },
  );

  it("rejects a medium that does not exist", () => {
    expect(errorPaths({ ...validInput, medium: "CARD" })).toEqual(["medium"]);
  });
});
