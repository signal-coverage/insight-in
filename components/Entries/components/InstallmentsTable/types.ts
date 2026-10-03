import type {
  InstallmentCounts,
  InstallmentPlanRow,
} from "@/components/Entries/types";

// The words that depend on what the plans are: purchases to pay or loans to collect.
export interface InstallmentsTableCopy {
  // The header of the first column ("Compra", "Concepto").
  purchaseHeader: string;
  // The accessible name of the table.
  tableLabel: string;
  loadingLabel: string;
}

export interface InstallmentsTableProps {
  copy: InstallmentsTableCopy;
  // The plans that still have installments to pay or collect.
  rows: readonly InstallmentPlanRow[];
  counts: InstallmentCounts;
  // True while the choices are being applied: nothing can change then.
  isDisabled: boolean;
  onCountChange: (id: string, value: number) => void;
}
