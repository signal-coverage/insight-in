import type { CardFieldErrors } from "@/core/cards/types";

// One cap while the form is open: the currency chosen and the amount as typed. `key` keeps each row's
// identity while rows are added and removed.
export interface LimitDraft {
  key: number;
  currency: string;
  amount: string;
}

export interface LimitsFieldProps {
  // The stored caps on edit (none for a new card).
  defaultLimits: readonly { currency: string; limitDecimal: string }[];
  // What the server said, keyed "limits", "limits.<index>.currency" and "limits.<index>.amount".
  fieldErrors: CardFieldErrors;
}
