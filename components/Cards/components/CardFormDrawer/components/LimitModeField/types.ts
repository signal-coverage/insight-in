import type { CardLimitMode } from "@/core/cards/types";

export interface LimitModeFieldProps {
  // The kind of cap selected when the form opens: monthly for a new card, the stored one on edit.
  defaultMode: CardLimitMode;
}

export interface LimitModeOption {
  value: CardLimitMode;
  label: string;
  hint: string;
}
