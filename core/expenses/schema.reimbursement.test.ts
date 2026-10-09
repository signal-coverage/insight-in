import { describe, expect, it } from "vitest";

import { EXPECTED_REIMBURSEMENT_MESSAGE } from "@/core/reimbursements/consts";

import { expenseInputSchema } from "./schema";

const validInput = {
  description: "Dentista",
  amount: "10000.00",
  currency: "ARS",
  date: "2026-09-12",
  categoryId: "cat_1",
  accountId: "acc_1",
  notes: "",
};

const parse = (extra: Record<string, unknown>) =>
  expenseInputSchema.safeParse({ ...validInput, ...extra });

const messages = (extra: Record<string, unknown>, path: string): string[] => {
  const result = parse(extra);

  return result.success
    ? []
    : result.error.issues
        .filter((issue) => issue.path.join(".") === path)
        .map((issue) => issue.message);
};

describe("expenseInputSchema expected reimbursement", () => {
  it.each([undefined, "", "   "])(
    "expects none when the field is empty (%j)",
    (empty) => {
      expect(
        parse({ expectedReimbursement: empty }).data?.expectedReimbursement,
      ).toBeNull();
    },
  );

  it("expects none when the field is not sent", () => {
    expect(parse({}).data?.expectedReimbursement).toBeNull();
  });

  it("converts the amount to minor units of the expense currency", () => {
    expect(
      parse({ expectedReimbursement: "4000.50" }).data?.expectedReimbursement,
    ).toBe(400050);
    expect(
      parse({
        currency: "JPY",
        amount: "10000",
        expectedReimbursement: "4000",
      }).data?.expectedReimbursement,
    ).toBe(4000);
  });

  it.each(["abc", "0", "0.00", "-5", "4.001", "1,5"])("rejects %j", (value) => {
    expect(
      messages({ expectedReimbursement: value }, "expectedReimbursement"),
    ).toEqual([EXPECTED_REIMBURSEMENT_MESSAGE]);
  });

  it("does not judge it when the currency is unsupported: that is reported on its own field", () => {
    expect(
      messages(
        { currency: "XXX", expectedReimbursement: "5" },
        "expectedReimbursement",
      ),
    ).toEqual([]);
  });

  it("checks a reimbursement in a crypto currency instead of skipping it", () => {
    const usdc = { currency: "USDC", amount: "10" };

    expect(
      parse({ ...usdc, expectedReimbursement: "1.5" }).data
        ?.expectedReimbursement,
    ).toBe(1500000);
    expect(
      messages(
        { ...usdc, expectedReimbursement: "1.1234567" },
        "expectedReimbursement",
      ),
    ).toEqual([EXPECTED_REIMBURSEMENT_MESSAGE]);
  });
});
