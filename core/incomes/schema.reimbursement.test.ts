import { describe, expect, it } from "vitest";

import { incomeInputSchema } from "./schema";

const validInput = {
  description: "Reintegro obra social",
  amount: "6000.00",
  currency: "ARS",
  date: "2026-09-20",
  categoryId: "cat_1",
  notes: "",
};

describe("incomeInputSchema reimbursed expense", () => {
  it.each([undefined, "", "   "])(
    "pays nothing back when the field is empty (%j)",
    (empty) => {
      expect(
        incomeInputSchema.safeParse({
          ...validInput,
          reimbursesExpenseId: empty,
        }).data?.reimbursesExpenseId,
      ).toBeNull();
    },
  );

  it("pays nothing back when the field is not sent", () => {
    expect(
      incomeInputSchema.safeParse(validInput).data?.reimbursesExpenseId,
    ).toBeNull();
  });

  it("keeps the id of the expense it pays back, trimmed", () => {
    expect(
      incomeInputSchema.safeParse({
        ...validInput,
        reimbursesExpenseId: "  exp_1 ",
      }).data?.reimbursesExpenseId,
    ).toBe("exp_1");
  });
});
