import type { RecurringChoice } from "@/core/expenses/types";

import { CHOICE_OPTIONS } from "./consts";

// The radio group hands back plain text; only the three known choices are accepted.
export const isChoice = (value: string): value is RecurringChoice =>
  CHOICE_OPTIONS.some((option) => option.value === value);
