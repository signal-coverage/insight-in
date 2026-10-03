import { z } from "zod";

import type { IssueContext } from "@/core/entries/fields";
import { SUPPORTED_CURRENCY_CODES } from "@/core/incomes/consts";
import { toMinorUnits } from "@/core/incomes/money";

import { EXPECTED_REIMBURSEMENT_MESSAGE } from "./consts";

const SUPPORTED_CURRENCY_SET = new Set(SUPPORTED_CURRENCY_CODES);

// An empty field (or one that is not sent) is "not filled in".
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null);

// What an expense expects to be paid back, as typed (a plain decimal in the currency of the expense).
export const expectedReimbursementField = optionalText;

// The id of the expense an income pays back.
export const reimbursesExpenseIdField = optionalText;

// The amount depends on the currency (its decimals), so it is checked after the fields. An
// unsupported currency is already reported on its own field.
export const checkExpectedReimbursement = (
  value: { expectedReimbursement: string | null; currency: string },
  ctx: IssueContext,
): void => {
  if (
    value.expectedReimbursement === null ||
    !SUPPORTED_CURRENCY_SET.has(value.currency)
  ) {
    return;
  }

  const minorUnits = toMinorUnits(value.expectedReimbursement, value.currency);

  if (minorUnits === null || minorUnits <= 0) {
    ctx.addIssue({
      code: "custom",
      path: ["expectedReimbursement"],
      message: EXPECTED_REIMBURSEMENT_MESSAGE,
    });
  }
};

// Safe after checkExpectedReimbursement has rejected anything toMinorUnits cannot parse.
export const toExpectedReimbursement = (value: {
  expectedReimbursement: string | null;
  currency: string;
}): number | null =>
  value.expectedReimbursement === null
    ? null
    : (toMinorUnits(value.expectedReimbursement, value.currency) as number);
