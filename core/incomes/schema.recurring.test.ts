import { describe, expect, it } from "vitest";

import { recurringIncomeInputSchema } from "./schema";

const validInput = {
  description: "Monthly salary",
  amount: "2500.00",
  currency: "USD",
  categoryId: "cat_1",
  notes: "Paid on the 5th",
  frequency: "MONTHLY",
  startDate: "2026-01-05",
  endDate: "2026-12-05",
};

const errorPaths = (input: unknown): string[] => {
  const result = recurringIncomeInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("recurringIncomeInputSchema", () => {
  it("parses a valid input and converts the amount to minor units", () => {
    expect(recurringIncomeInputSchema.safeParse(validInput).data).toEqual({
      description: "Monthly salary",
      amount: 250000,
      currency: "USD",
      categoryId: "cat_1",
      notes: "Paid on the 5th",
      medium: "DIGITAL",
      frequency: "MONTHLY",
      startDate: "2026-01-05",
      endDate: "2026-12-05",
    });
  });

  it("defaults the medium to digital and accepts cash", () => {
    expect(recurringIncomeInputSchema.safeParse(validInput).data?.medium).toBe(
      "DIGITAL",
    );
    expect(
      recurringIncomeInputSchema.safeParse({ ...validInput, medium: "CASH" })
        .data?.medium,
    ).toBe("CASH");
  });

  it("rejects an unknown medium", () => {
    expect(errorPaths({ ...validInput, medium: "CARD" })).toEqual(["medium"]);
  });

  it("allows a series without an end date", () => {
    for (const endDate of [undefined, "", "   "]) {
      const result = recurringIncomeInputSchema.safeParse({
        ...validInput,
        endDate,
      });

      expect(result.data?.endDate).toBeNull();
    }
  });

  it("normalizes empty notes to null and trims text", () => {
    const result = recurringIncomeInputSchema.safeParse({
      ...validInput,
      description: "  Rent  ",
      notes: "  ",
    });

    expect(result.data).toMatchObject({ description: "Rent", notes: null });
  });

  it.each(["WEEKLY", "MONTHLY", "YEARLY"])(
    "accepts the %s frequency",
    (frequency) => {
      expect(
        recurringIncomeInputSchema.safeParse({ ...validInput, frequency })
          .success,
      ).toBe(true);
    },
  );

  it.each(["DAILY", "monthly", "", undefined])(
    "rejects the frequency %j",
    (frequency) => {
      expect(errorPaths({ ...validInput, frequency })).toContain("frequency");
    },
  );

  it("allows a start date in the past (it backfills)", () => {
    expect(
      recurringIncomeInputSchema.safeParse({
        ...validInput,
        startDate: "2020-01-01",
      }).success,
    ).toBe(true);
  });

  it.each(["2026-13-01", "01/05/2026", "2026-02-30", "", undefined])(
    "rejects the start date %j",
    (startDate) => {
      expect(errorPaths({ ...validInput, startDate })).toContain("startDate");
    },
  );

  it("rejects an invalid end date", () => {
    expect(errorPaths({ ...validInput, endDate: "2026-02-30" })).toContain(
      "endDate",
    );
  });

  it("rejects an end date before the start date but accepts the same day", () => {
    expect(
      errorPaths({
        ...validInput,
        startDate: "2026-06-01",
        endDate: "2026-05-31",
      }),
    ).toContain("endDate");
    expect(
      recurringIncomeInputSchema.safeParse({
        ...validInput,
        startDate: "2026-06-01",
        endDate: "2026-06-01",
      }).success,
    ).toBe(true);
  });

  it("reuses the income rules for amount, currency, description and category", () => {
    expect(errorPaths({ ...validInput, amount: "abc" })).toContain("amount");
    expect(errorPaths({ ...validInput, amount: "0" })).toContain("amount");
    expect(errorPaths({ ...validInput, currency: "ZZZ" })).toContain(
      "currency",
    );
    expect(errorPaths({ ...validInput, description: " " })).toContain(
      "description",
    );
    expect(errorPaths({ ...validInput, categoryId: "" })).toContain(
      "categoryId",
    );
  });
});
