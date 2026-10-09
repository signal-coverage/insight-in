import { CURRENCY_OPTIONS } from "@/components/Entries/currencyOptions";
import type { CurrencyOption } from "@/components/Entries/currencyOptions";
import { DEFAULT_CURRENCY_CODE } from "@/core/incomes/consts";

import type { LimitDraft, LimitsFieldProps } from "./types";

// The rows the list starts with: the stored caps on edit, one empty cap in the default currency for a
// new card.
export const initialRows = (
  defaults: LimitsFieldProps["defaultLimits"],
): LimitDraft[] =>
  defaults.length > 0
    ? defaults.map((limit, index) => ({
        key: index,
        currency: limit.currency,
        amount: limit.limitDecimal,
      }))
    : [{ key: 0, currency: DEFAULT_CURRENCY_CODE, amount: "" }];

// The currency a new row starts in: the first of the list that no cap uses yet.
export const firstFreeCurrency = (used: readonly string[]): string | null =>
  CURRENCY_OPTIONS.find(({ code }) => !used.includes(code))?.code ?? null;

// The currencies a row can pick: its own and every one no other row uses, so a currency never gets
// two caps.
export const currencyChoices = (
  rows: readonly LimitDraft[],
  index: number,
): CurrencyOption[] =>
  CURRENCY_OPTIONS.filter(
    ({ code }) =>
      code === rows[index]?.currency ||
      !rows.some((row) => row.currency === code),
  );
