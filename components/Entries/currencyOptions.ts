import {
  PRIORITY_CURRENCY_CODES,
  SUPPORTED_CURRENCY_CODES,
} from "@/core/incomes/consts";

import { CURRENCY_NAME_LOCALE } from "./formConsts";

export interface CurrencyOption {
  code: string;
  label: string;
}

const priorityRank = (code: string): number => {
  const index = PRIORITY_CURRENCY_CODES.indexOf(code);

  return index === -1 ? PRIORITY_CURRENCY_CODES.length : index;
};

// Priority currencies first (in their declared order), then everything else alphabetically.
export const buildCurrencyOptions = (): CurrencyOption[] => {
  const names = new Intl.DisplayNames([CURRENCY_NAME_LOCALE], {
    type: "currency",
  });

  return [...SUPPORTED_CURRENCY_CODES]
    .sort((a, b) => priorityRank(a) - priorityRank(b) || a.localeCompare(b))
    .map((code) => ({ code, label: `${code} - ${names.of(code) ?? code}` }));
};

export const CURRENCY_OPTIONS: readonly CurrencyOption[] =
  buildCurrencyOptions();
