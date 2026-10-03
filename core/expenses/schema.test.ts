import { describe, expect, it } from "vitest";

import { expenseInputSchema } from "./schema";

const validInput = {
  description: "Monthly rent",
  amount: "350000.50",
  currency: "ARS",
  date: "2026-09-05",
  categoryId: "cat_1",
  notes: "Paid by transfer",
};

const errorPaths = (input: unknown): string[] => {
  const result = expenseInputSchema.safeParse(input);

  return result.success
    ? []
    : result.error.issues.map((issue) => issue.path.join("."));
};

describe("expenseInputSchema", () => {
  it("parses a valid input, converting the amount to minor units", () => {
    expect(expenseInputSchema.safeParse(validInput).data).toEqual({
      description: "Monthly rent",
      amount: 35000050,
      currency: "ARS",
      date: "2026-09-05",
      categoryId: "cat_1",
      notes: "Paid by transfer",
      status: "SETTLED",
      medium: "DIGITAL",
      isRecurring: false,
      cardId: null,
      originCurrency: null,
      originAmount: null,
      expectedReimbursement: null,
    });
  });

  it("reads the card as optional: nothing or an empty choice means no card", () => {
    expect(expenseInputSchema.safeParse(validInput).data?.cardId).toBeNull();
    expect(
      expenseInputSchema.safeParse({ ...validInput, cardId: "" }).data?.cardId,
    ).toBeNull();
    expect(
      expenseInputSchema.safeParse({ ...validInput, cardId: "  " }).data
        ?.cardId,
    ).toBeNull();
  });

  it("keeps the id of the card that was chosen", () => {
    expect(
      expenseInputSchema.safeParse({ ...validInput, cardId: " card_1 " }).data
        ?.cardId,
    ).toBe("card_1");
  });

  it("defaults the medium to digital and accepts cash", () => {
    expect(expenseInputSchema.safeParse(validInput).data?.medium).toBe(
      "DIGITAL",
    );
    expect(
      expenseInputSchema.safeParse({ ...validInput, medium: "CASH" }).data
        ?.medium,
    ).toBe("CASH");
    expect(errorPaths({ ...validInput, medium: "CARD" })).toEqual(["medium"]);
  });

  it("defaults the status to settled and accepts planned", () => {
    expect(
      expenseInputSchema.safeParse({ ...validInput, status: "PLANNED" }).data
        ?.status,
    ).toBe("PLANNED");
    expect(errorPaths({ ...validInput, status: "DONE" })).toEqual(["status"]);
  });

  it("accepts COVERED: any expense may be paid by someone else", () => {
    expect(
      expenseInputSchema.safeParse({ ...validInput, status: "COVERED" }).data
        ?.status,
    ).toBe("COVERED");
  });

  it("reads the recurring mark from the form's 'true' / 'false' text", () => {
    expect(
      expenseInputSchema.safeParse({ ...validInput, isRecurring: "true" }).data
        ?.isRecurring,
    ).toBe(true);
    expect(
      expenseInputSchema.safeParse({ ...validInput, isRecurring: "false" }).data
        ?.isRecurring,
    ).toBe(false);
    expect(errorPaths({ ...validInput, isRecurring: "maybe" })).toEqual([
      "isRecurring",
    ]);
  });

  it("treats empty notes as no notes", () => {
    expect(
      expenseInputSchema.safeParse({ ...validInput, notes: "  " }).data?.notes,
    ).toBeNull();
  });

  it.each(["description", "categoryId", "amount", "currency", "date"] as const)(
    "requires %s",
    (field) => {
      expect(errorPaths({ ...validInput, [field]: undefined })).toContain(
        field,
      );
    },
  );

  it.each(["0", "-5", "abc", "1,5"])("rejects the amount %j", (amount) => {
    expect(errorPaths({ ...validInput, amount })).toEqual(["amount"]);
  });

  it("rejects an unsupported currency and an impossible date", () => {
    expect(errorPaths({ ...validInput, currency: "XXX" })).toContain(
      "currency",
    );
    expect(errorPaths({ ...validInput, date: "2026-02-30" })).toEqual(["date"]);
  });
});
