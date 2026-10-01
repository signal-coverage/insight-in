import { describe, expect, it } from "vitest";

import { categoryInputSchema, incomeInputSchema } from "./schema";

const validInput = {
  description: "September salary",
  amount: "1500.50",
  currency: "USD",
  date: "2026-09-01",
  categoryId: "cat_1",
  notes: "Paid by wire transfer",
};

const errorPaths = (input: unknown): string[] => {
  const result = incomeInputSchema.safeParse(input);

  if (result.success) {
    return [];
  }

  return result.error.issues.map((issue) => issue.path.join("."));
};

describe("incomeInputSchema", () => {
  it("parses a valid input and converts the amount to minor units", () => {
    const result = incomeInputSchema.safeParse(validInput);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      description: "September salary",
      amount: 150050,
      currency: "USD",
      date: "2026-09-01",
      categoryId: "cat_1",
      notes: "Paid by wire transfer",
      status: "SETTLED",
    });
  });

  it("defaults the status to settled and accepts planned", () => {
    expect(incomeInputSchema.safeParse(validInput).data?.status).toBe(
      "SETTLED",
    );
    expect(
      incomeInputSchema.safeParse({ ...validInput, status: "PLANNED" }).data
        ?.status,
    ).toBe("PLANNED");
  });

  it("rejects an unknown status", () => {
    expect(errorPaths({ ...validInput, status: "DONE" })).toEqual(["status"]);
  });

  it("trims text fields", () => {
    const result = incomeInputSchema.safeParse({
      ...validInput,
      description: "  Freelance  ",
      categoryId: "  cat_2  ",
      notes: "  note  ",
    });

    expect(result.data).toMatchObject({
      description: "Freelance",
      categoryId: "cat_2",
      notes: "note",
    });
  });

  it.each([undefined, "", "   "])(
    "normalizes empty notes %j to null",
    (notes) => {
      const result = incomeInputSchema.safeParse({ ...validInput, notes });

      expect(result.data?.notes).toBeNull();
    },
  );

  it("applies the currency exponent when converting", () => {
    const result = incomeInputSchema.safeParse({
      ...validInput,
      currency: "JPY",
      amount: "1500",
    });

    expect(result.data?.amount).toBe(1500);
  });

  it.each(["description", "categoryId"] as const)("requires %s", (field) => {
    expect(errorPaths({ ...validInput, [field]: "  " })).toContain(field);
    expect(errorPaths({ ...validInput, [field]: undefined })).toContain(field);
  });

  it("rejects an oversized description", () => {
    expect(
      errorPaths({ ...validInput, description: "x".repeat(201) }),
    ).toContain("description");
  });

  it("rejects oversized notes", () => {
    expect(errorPaths({ ...validInput, notes: "x".repeat(1001) })).toContain(
      "notes",
    );
  });

  it("rejects a currency outside the supported list", () => {
    expect(errorPaths({ ...validInput, currency: "ZZZ" })).toContain(
      "currency",
    );
  });

  it("rejects a lowercase currency code", () => {
    expect(errorPaths({ ...validInput, currency: "usd" })).toContain(
      "currency",
    );
  });

  it.each(["abc", "-5", "1,50", "", "10.999", "0", "0.00"])(
    "rejects amount %j",
    (amount) => {
      expect(errorPaths({ ...validInput, amount })).toContain("amount");
    },
  );

  it("rejects an amount that exceeds the safe integer range", () => {
    expect(
      errorPaths({ ...validInput, amount: "90071992547409.92" }),
    ).toContain("amount");
  });

  it.each(["2026-13-45", "09/01/2026", "2026-02-30", "", "tomorrow"])(
    "rejects date %j",
    (date) => {
      expect(errorPaths({ ...validInput, date })).toContain("date");
    },
  );

  it("reports every invalid field at once", () => {
    const paths = errorPaths({
      description: "",
      amount: "x",
      currency: "ZZZ",
      date: "nope",
      categoryId: "",
    });

    expect(paths).toEqual(
      expect.arrayContaining(["description", "currency", "date", "categoryId"]),
    );
  });

  it("does not report the amount against an unsupported currency", () => {
    expect(errorPaths({ ...validInput, currency: "ZZZ" })).toEqual([
      "currency",
    ]);
  });
});

describe("categoryInputSchema", () => {
  it("accepts and trims a name", () => {
    const result = categoryInputSchema.safeParse({ name: "  Side projects  " });

    expect(result.data).toEqual({ name: "Side projects" });
  });

  it.each(["", "   ", undefined])("rejects an empty name %j", (name) => {
    expect(categoryInputSchema.safeParse({ name }).success).toBe(false);
  });

  it("accepts a name of exactly 40 characters and rejects 41", () => {
    expect(
      categoryInputSchema.safeParse({ name: "x".repeat(40) }).success,
    ).toBe(true);
    expect(
      categoryInputSchema.safeParse({ name: "x".repeat(41) }).success,
    ).toBe(false);
  });
});
