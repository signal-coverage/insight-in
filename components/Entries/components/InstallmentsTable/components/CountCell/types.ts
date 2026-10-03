import type { InstallmentPlanRow } from "@/components/Entries/types";

export interface CountCellProps {
  row: InstallmentPlanRow;
  // How many installments of the plan fall in the month: the default until the user changes it.
  value: number;
  isDisabled: boolean;
  onChange: (value: number) => void;
}
