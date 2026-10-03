import type { AmountMode } from "@/core/installments/types";

export interface AmountModeFieldProps {
  value: AmountMode;
  onChange: (mode: AmountMode) => void;
}

export interface AmountModeOption {
  value: AmountMode;
  label: string;
}
