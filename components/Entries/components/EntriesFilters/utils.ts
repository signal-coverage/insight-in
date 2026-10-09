import { compareCurrencyCodes } from "@/core/currencies/crypto";
import { isValidIsoDate } from "@/core/incomes/dates";

import { MIN_FILTER_YEAR, PLANNED_LABEL } from "./consts";
import type { FilterOption } from "./types";

// "" clears the filter; anything else must be a real date past the year still being typed.
export const isCommittableDate = (value: string): boolean =>
  value === "" ||
  (isValidIsoDate(value) && Number(value.slice(0, 4)) >= MIN_FILTER_YEAR);

// The statuses the filter offers: listed and settled always, covered only when this side has a word
// for it.
export const statusOptions = (
  settledLabel: string,
  coveredLabel?: string,
): FilterOption[] => [
  { id: "PLANNED", label: PLANNED_LABEL },
  { id: "SETTLED", label: settledLabel },
  ...(coveredLabel ? [{ id: "COVERED", label: coveredLabel }] : []),
];

// The currencies in use, plus the active one so a shared link never shows an empty Select.
export const buildCurrencyOptions = (
  currencies: readonly string[],
  active: string | null,
): FilterOption[] =>
  Array.from(new Set(active ? [...currencies, active] : currencies))
    .sort(compareCurrencyCodes)
    .map((code) => ({ id: code, label: code }));
