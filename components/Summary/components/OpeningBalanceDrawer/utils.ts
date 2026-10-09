import { formatMonth, shiftMonth } from "@/core/summary/month";

import { MONTH_FIELD_NAME, OPENING_MONTHS_BACK } from "./consts";
import type {
  MonthOption,
  OpeningBalancePayload,
  OpeningBankGroup,
} from "./types";

export { openingRowLabel } from "./rowLabel";

// The months the chooser offers, most recent first: from the month in course back
// OPENING_MONTHS_BACK months, plus the saved one when it is older than that, so it can be shown.
export const monthOptions = (
  currentMonth: string,
  savedMonth: string | null,
): MonthOption[] => {
  const months = Array.from({ length: OPENING_MONTHS_BACK + 1 }, (_, back) =>
    shiftMonth(currentMonth, -back),
  );

  if (savedMonth !== null && !months.includes(savedMonth)) {
    months.push(savedMonth);
  }

  return months
    .sort((a, b) => b.localeCompare(a))
    .map((value) => ({ value, label: formatMonth(value) }));
};

// The name of an amount input. It is the path the server reports its errors under, so a message
// lands on the field it is about.
export const amountFieldName = (index: number): string =>
  `balances.${index}.amount`;

const textOf = (formData: FormData, name: string): string => {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
};

// Reads the form into what the save action takes: the month and one row per account. The rows go in
// the order of their index, not the groups' (banks can interleave their accounts), so a row's
// position in the payload, which is where the server reports its errors, is always the number in
// the name of its input.
export const toPayload = (
  formData: FormData,
  groups: readonly OpeningBankGroup[],
): OpeningBalancePayload => ({
  month: textOf(formData, MONTH_FIELD_NAME),
  balances: groups
    .flatMap(({ rows }) => rows)
    .sort((a, b) => a.index - b.index)
    .map(({ index, accountId, currency }) => ({
      accountId,
      currency,
      amount: textOf(formData, amountFieldName(index)),
    })),
});
