import { formatMonth, shiftMonth } from "@/core/summary/month";

import { MONTH_FIELD_NAME, OPENING_MONTHS_BACK } from "./consts";
import type {
  MonthOption,
  OpeningBalancePayload,
  OpeningBalanceRow,
} from "./types";

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
export const amountFieldName = (
  index: number,
  medium: "digital" | "cash",
): string => `balances.${index}.${medium}`;

const textOf = (formData: FormData, name: string): string => {
  const value = formData.get(name);

  return typeof value === "string" ? value : "";
};

// Reads the form into what the save action takes: the month and a row per currency.
export const toPayload = (
  formData: FormData,
  rows: readonly OpeningBalanceRow[],
): OpeningBalancePayload => ({
  month: textOf(formData, MONTH_FIELD_NAME),
  balances: rows.map(({ currency }, index) => ({
    currency,
    digital: textOf(formData, amountFieldName(index, "digital")),
    cash: textOf(formData, amountFieldName(index, "cash")),
  })),
});
